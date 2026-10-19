# Ancore Indexer Schema & Migration Guide

Comprehensive reference guide for the PostgreSQL database schema, data models, idempotency guarantees, and SQLx migration workflow powering the Ancore Indexer service.

---

## 1. Architecture & Entity-Relationship Model

The Ancore Indexer ingests ledger transactions and contract events from the Stellar/Soroban network, parses and normalizes user operations, and stores them in PostgreSQL to provide low-latency query APIs for wallet clients, account dashboards, and activity feeds.

```mermaid
erDiagram
    account_activity {
        uuid id PK
        varchar account_id
        varchar activity_type
        numeric amount
        varchar asset
        varchar asset_code
        varchar asset_issuer
        varchar counterparty
        varchar tx_hash
        bigint ledger_seq
        timestamptz created_at
        jsonb metadata
    }

    contract_events {
        uuid id PK
        varchar contract_address
        varchar account_id
        varchar event_type
        bigint ledger_seq
        timestamptz timestamp
        varchar tx_hash
        jsonb data
    }

    ingest_checkpoints {
        varchar stream PK
        bigint last_ledger_seq
        timestamptz updated_at
    }

    ingest_dead_letters {
        uuid id PK
        varchar stream
        bigint ledger_seq
        varchar tx_hash
        varchar contract_id
        text error_message
        jsonb raw_payload
        timestamptz created_at
        timestamptz reprocessed_at
    }

    schema_migrations {
        integer version PK
        text name
        timestamptz applied_at
    }
```

---

## 2. Table Specifications

### 2.1 `account_activity`

Stores normalized account activities (payments, contract calls, account creation, trustline changes) for wallet transaction history feeds.

| Column          | Type            | Constraints                             | Description                                                    |
| :-------------- | :-------------- | :-------------------------------------- | :------------------------------------------------------------- |
| `id`            | `UUID`          | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique activity identifier                                     |
| `account_id`    | `VARCHAR(56)`   | `NOT NULL`                              | Stellar public key (`G...`) of the affected account            |
| `activity_type` | `VARCHAR(50)`   | `NOT NULL`                              | Activity enum (`payment`, `invoke`, `create_account`, etc.)    |
| `amount`        | `NUMERIC(20,7)` | `NULL`                                  | Amount in decimal units (7 decimal precision matching Stroops) |
| `asset`         | `VARCHAR(100)`  | `NULL`                                  | Legacy/raw asset representation (`native` or `CODE:ISSUER`)    |
| `asset_code`    | `VARCHAR(12)`   | `NULL`                                  | Normalized asset code (`XLM`, `USDC`, etc.)                    |
| `asset_issuer`  | `VARCHAR(56)`   | `NULL`                                  | Stellar public key of the credit asset issuer (`NULL` for XLM) |
| `counterparty`  | `VARCHAR(56)`   | `NULL`                                  | Destination or source public key involved in the activity      |
| `tx_hash`       | `VARCHAR(64)`   | `NOT NULL`                              | 64-character lowercase hex Stellar transaction hash            |
| `ledger_seq`    | `BIGINT`        | `NOT NULL`                              | Ledger sequence number in which the transaction finalized      |
| `created_at`    | `TIMESTAMPTZ`   | `NOT NULL DEFAULT NOW()`                | UTC ledger close timestamp                                     |
| `metadata`      | `JSONB`         | `NULL`                                  | Extensible JSON payload with additional transaction details    |

**Idempotency & Indexes:**

- Constraint `uq_account_activity_tx_account_type_ledger`: `UNIQUE (tx_hash, account_id, activity_type, ledger_seq)`
- Index `idx_account_activity_account_created`: `(account_id, created_at DESC)` for chronological activity feeds.
- Index `idx_account_activity_account_ledger`: `(account_id, ledger_seq DESC)` for range and pagination scans.
- Index `idx_account_activity_tx_hash`: `(tx_hash)` for point lookups.

---

### 2.2 `contract_events`

Stores raw and decoded Soroban smart contract events emitted during ledger execution.

| Column             | Type          | Constraints                             | Description                                               |
| :----------------- | :------------ | :-------------------------------------- | :-------------------------------------------------------- |
| `id`               | `UUID`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique event identifier                                   |
| `contract_address` | `VARCHAR(56)` | `NOT NULL`                              | Soroban contract ID (`C...`)                              |
| `account_id`       | `VARCHAR(56)` | `NOT NULL`                              | Associated smart account or user identity address         |
| `event_type`       | `VARCHAR(50)` | `NOT NULL`                              | Event topic symbol (e.g. `session_key_added`, `transfer`) |
| `ledger_seq`       | `BIGINT`      | `NOT NULL`                              | Ledger sequence number                                    |
| `timestamp`        | `TIMESTAMPTZ` | `NOT NULL`                              | UTC timestamp of event emission                           |
| `tx_hash`          | `VARCHAR(64)` | `NOT NULL`                              | Transaction hash                                          |
| `data`             | `JSONB`       | `NOT NULL DEFAULT '{}'::jsonb`          | Decoded event payload parameters                          |

**Idempotency & Indexes:**

- Constraint `uq_contract_events_tx_event_ledger`: `UNIQUE (tx_hash, event_type, ledger_seq)`
- Index `idx_contract_events_contract_address`: `(contract_address)`
- Index `idx_contract_events_account_id`: `(account_id)`
- Index `idx_contract_events_account_id_event_type`: `(account_id, event_type)`
- Index `idx_contract_events_ledger_seq`: `(ledger_seq DESC)`
- Index `idx_contract_events_timestamp`: `(timestamp DESC)`

---

### 2.3 `ingest_checkpoints`

Tracks stream progress and watermark positions to ensure crash recovery and resumable stream ingestion.

| Column            | Type          | Constraints              | Description                                                            |
| :---------------- | :------------ | :----------------------- | :--------------------------------------------------------------------- |
| `stream`          | `VARCHAR(64)` | `PRIMARY KEY`            | Ingestion stream identifier (e.g. `mainnet_ledgers`, `testnet_events`) |
| `last_ledger_seq` | `BIGINT`      | `NOT NULL`               | Highest continuous ledger sequence committed to the database           |
| `updated_at`      | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Timestamp of last watermark update                                     |

---

### 2.4 `ingest_dead_letters`

Dead-letter queue (DLQ) storing unparseable or rejected events so that ingestion continues without dropping malformed records.

| Column           | Type          | Constraints                             | Description                                         |
| :--------------- | :------------ | :-------------------------------------- | :-------------------------------------------------- |
| `id`             | `UUID`        | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique dead letter record ID                        |
| `stream`         | `VARCHAR(64)` | `NOT NULL`                              | Source stream name                                  |
| `ledger_seq`     | `BIGINT`      | `NOT NULL`                              | Ledger sequence where failure occurred              |
| `tx_hash`        | `VARCHAR(64)` | `NOT NULL DEFAULT ''`                   | Transaction hash if known                           |
| `contract_id`    | `VARCHAR(56)` | `NOT NULL DEFAULT ''`                   | Contract ID if known                                |
| `error_message`  | `TEXT`        | `NOT NULL`                              | Stack trace or failure description                  |
| `raw_payload`    | `JSONB`       | `NOT NULL`                              | Unprocessed raw payload                             |
| `created_at`     | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()`                | Time failure was caught                             |
| `reprocessed_at` | `TIMESTAMPTZ` | `NULL`                                  | Populated when dead letter is replayed and resolved |

**Idempotency & Indexes:**

- Constraint `uq_ingest_dead_letters_stream_ledger_tx`: `UNIQUE (stream, ledger_seq, tx_hash)`
- Index `idx_ingest_dead_letters_stream_ledger`: `(stream, ledger_seq DESC)`
- Partial Index `idx_ingest_dead_letters_unprocessed`: `(created_at) WHERE reprocessed_at IS NULL`

---

### 2.5 `schema_migrations`

Internal ledger tracking applied migrations. Queried by the `/health` endpoint to report database readiness and schema versions.

| Column       | Type          | Constraints              | Description                                  |
| :----------- | :------------ | :----------------------- | :------------------------------------------- |
| `version`    | `INTEGER`     | `PRIMARY KEY`            | Migration sequence number (1, 2, 3...)       |
| `name`       | `TEXT`        | `NOT NULL`               | Description matching the migration file name |
| `applied_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | When the migration was executed              |

---

## 3. Migration Catalog (001 - 009)

Every migration file resides in `services/indexer/migrations/` and follows strict sequence numbering.

1. **`001_create_account_activity_table.sql`**: Initial schema defining `account_activity` and core query indexes (`account_id`, `ledger_seq`, `tx_hash`).
2. **`002_create_ingest_checkpoints_table.sql`**: Creates `ingest_checkpoints` watermark table to enable checkpoint resumption.
3. **`003_add_asset_code_issuer_to_account_activity.sql`**: Adds normalized `asset_code` and `asset_issuer` columns and backfills existing rows from `asset`.
4. **`004_create_contract_events_table.sql`**: Creates `contract_events` table for Soroban contract event ingestion.
5. **`005_create_schema_migrations_table.sql`**: Creates `schema_migrations` audit ledger and backfills versions 1–5.
6. **`006_add_account_id_to_contract_events.sql`**: Adds `account_id` to `contract_events` with indexing and backfill.
7. **`007_add_ingest_idempotency_constraints.sql`**: Adds unique constraints to `contract_events` and `account_activity` to guarantee idempotent replay and deduplication.
8. **`008_create_ingest_dead_letters_table.sql`**: Creates `ingest_dead_letters` table for recording unparseable events.
9. **`009_add_dead_letter_idempotency.sql`**: Adds unique constraint `uq_ingest_dead_letters_stream_ledger_tx` to prevent duplicate dead-letter entries upon retries.

---

## 4. Local Setup & Docker Development Workflow

### Step 1: Start PostgreSQL via Docker

```bash
docker run -d \
  --name ancore-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ancore_indexer \
  -p 5432:5432 \
  postgres:16-alpine
```

### Step 2: Configure Environment Variable

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/ancore_indexer"
```

### Step 3: Run SQLx Migrations

Apply all migrations in order:

```bash
sqlx migrate run --source services/indexer/migrations
```

Revert the last migration (if needed during testing):

```bash
sqlx migrate revert --source services/indexer/migrations
```

### Step 4: Validate Offline Query Metadata (SQLx Prepare)

The Ancore Indexer uses SQLx compile-time query verification. In CI, queries are validated against cached metadata in `.sqlx/`:

```bash
cd services/indexer
cargo sqlx prepare --check
```

To update the `.sqlx` query cache after modifying SQL queries:

```bash
cd services/indexer
cargo sqlx prepare
```

---

## 5. Migration Linting Conventions

All migration files are automatically verified by CI using `services/indexer/scripts/lint-migrations.mjs`.

### Conventions:

- **Filename Pattern**: `^\\d{3}_[a-z][a-z0-9_]*\\.sql$` (e.g. `010_add_user_preferences_table.sql`).
- **Sequencing**: Exactly 3 zero-padded digits with strictly ascending, non-duplicate sequence numbers.
- **Ledger Ingestion**: Every migration starting from 005 must include:
  ```sql
  INSERT INTO schema_migrations (version, name)
  VALUES (10, 'add_user_preferences_table')
  ON CONFLICT (version) DO NOTHING;
  ```

### Running the Linter:

```bash
node services/indexer/scripts/lint-migrations.mjs
```

Exits `0` on success and `1` on any duplicate sequence or invalid filename.
