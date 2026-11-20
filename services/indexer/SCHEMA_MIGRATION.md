# Indexer schema and migration process

> Canonical reference for the `services/indexer` PostgreSQL schema: the tables
> that exist today, how a migration is applied, and what to do when a migration
> has to be added, verified, or recovered.
>
> Related: [Indexer README](README.md) · [Contract event catalog](../../docs/indexer/contract-events.md) ·
> [Backfill guide](docs/BACKFILL.md) · [Query architecture](docs/QUERY_ARCHITECTURE.md) ·
> [Indexer backfill and dead-letter runbook](../../docs/ops/runbooks/indexer-backfill-and-dead-letter-reprocessing.md)

## How migrations are applied

Migration files live in [`migrations/`](migrations) and are plain `.sql` applied
in filename order via `psql`:

```
services/indexer/migrations/
├── 001_create_account_activity_table.sql
├── 002_create_ingest_checkpoints_table.sql
├── 003_add_asset_code_issuer_to_account_activity.sql
├── 004_create_contract_events_table.sql
├── 005_create_schema_migrations_table.sql
├── 006_add_account_id_to_contract_events.sql
├── 007_add_ingest_idempotency_constraints.sql
├── 008_create_ingest_dead_letters_table.sql
└── 009_add_dead_letter_idempotency.sql
```

Apply migrations with:

```bash
# Apply all migrations in order
for f in services/indexer/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

# Or apply a single migration file
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f services/indexer/migrations/001_create_account_activity_table.sql
```

The indexer binary does **not** create or alter schema at startup. Migrations are
applied out-of-band with `psql` (see [Applying and verifying](#applying-and-verifying)),
which is why `/health` reports the schema version the database is serving instead
of assuming the deployed image defines it.

Each file is written to be applied **exactly once**, and the `schema_migrations`
ledger — not the SQL itself — is what guarantees that. Several statements are
deliberately not idempotent (`CREATE INDEX` in `001`, `ADD CONSTRAINT` in `007`
and `009`), so re-running an already-applied file against a live database fails.
Run migration scripts against a scratch database, not a shared one.

## The `schema_migrations` ledger

Migration `005` introduced the ledger that every later file writes to:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

It backfills the five migrations that shipped before it existed
(`ON CONFLICT (version) DO NOTHING`, so databases created from scratch and
databases upgraded in place end up identical). **Every migration from `005`
onwards must end with its own ledger insert**, matching the file's sequence
number and description:

```sql
INSERT INTO schema_migrations (version, name)
VALUES (10, 'add_my_change')
ON CONFLICT (version) DO NOTHING;
```

`GET /health` reads the ledger through
[`fetch_migration_state`](src/repositories/migrations.rs) and returns:

| Field                     | Source                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| `schema_version`          | `MAX(version)` in the ledger; `null` when the ledger is absent or empty |
| `expected_schema_version` | `EXPECTED_SCHEMA_VERSION` compiled into this binary                     |
| `migration_status`        | classification of the two above                                         |
| `latest_migration`        | `name` of the highest applied migration                                 |
| `migration_applied_at`    | `applied_at` of the highest applied migration                           |
| `applied_migrations`      | row count in the ledger                                                 |

`migration_status` is `up_to_date`, `pending` (database behind), `ahead`
(database migrated by a newer indexer) or `unknown` (ledger missing or empty).
Only `up_to_date` is healthy — see
[`MigrationStatus::is_healthy`](src/repositories/migrations.rs) — so a deploy
gate that checks `migration_status` distinguishes "migrations have not finished"
from "ledger lag", which a bare `/health` status cannot.

## Current schema

### `account_activity` — Horizon account operations (`001`, extended by `003`)

| Column          | Type            | Notes                                           |
| --------------- | --------------- | ----------------------------------------------- |
| `id`            | `UUID`          | Primary key, `gen_random_uuid()`                |
| `account_id`    | `VARCHAR(56)`   | Stellar account (G…)                            |
| `activity_type` | `VARCHAR(50)`   | `payment`, `create_account`, `set_options`, …   |
| `amount`        | `NUMERIC(20,7)` | `NULL` for non-value operations                 |
| `asset`         | `VARCHAR(100)`  | Legacy asset string (`native` or `CODE:ISSUER`) |
| `asset_code`    | `VARCHAR(12)`   | `XLM` or credit-asset code (added in `003`)     |
| `asset_issuer`  | `VARCHAR(56)`   | `NULL` for native XLM (added in `003`)          |
| `counterparty`  | `VARCHAR(56)`   | Other account in the operation                  |
| `tx_hash`       | `VARCHAR(64)`   | Transaction hash, hex                           |
| `ledger_seq`    | `BIGINT`        | Ledger sequence                                 |
| `created_at`    | `TIMESTAMPTZ`   | Defaults to `NOW()`                             |
| `metadata`      | `JSONB`         | Extensible per-operation detail                 |

Indexes: `(account_id, created_at DESC)` — activity feeds;
`(account_id, activity_type, created_at DESC)` — filtered feeds;
`(account_id, ledger_seq DESC)` — ledger ranges; `(tx_hash)` — transaction lookups.
Unique constraint `uq_account_activity_tx_type_ledger (tx_hash, activity_type, ledger_seq)`
from `007` — the conflict target real-time ingestion and backfill both insert against.

### `ingest_checkpoints` — ingestion cursors (`002`)

| Column            | Type          | Notes                                         |
| ----------------- | ------------- | --------------------------------------------- |
| `stream`          | `VARCHAR(64)` | Primary key — one cursor per ingestion stream |
| `last_ledger_seq` | `BIGINT`      | Last durably persisted ledger                 |
| `updated_at`      | `TIMESTAMPTZ` | Defaults to `NOW()`                           |

The worker loads this cursor on startup and advances it only after a batch is
persisted, so a restart resumes instead of replaying.

### `contract_events` — Soroban events (`004`, extended by `006`)

| Column             | Type          | Notes                                                                                     |
| ------------------ | ------------- | ----------------------------------------------------------------------------------------- |
| `id`               | `UUID`        | Primary key, `gen_random_uuid()`                                                          |
| `contract_address` | `VARCHAR(56)` | Emitting contract (C…)                                                                    |
| `account_id`       | `VARCHAR(56)` | Wallet-scoped lookup key; backfilled to `contract_address` (added in `006`)               |
| `event_type`       | `VARCHAR(50)` | e.g. `session_key_added` — see the [event catalog](../../docs/indexer/contract-events.md) |
| `ledger_seq`       | `BIGINT`      | Ledger sequence                                                                           |
| `timestamp`        | `TIMESTAMPTZ` | Ledger close time                                                                         |
| `tx_hash`          | `VARCHAR(64)` | Transaction hash, hex                                                                     |
| `data`             | `JSONB`       | Decoded event payload, defaults to `{}`                                                   |

Indexes: `(contract_address)`, `(event_type)`, `(contract_address, event_type)`,
`(ledger_seq DESC)`, `(timestamp DESC)`, plus `(account_id)` and
`(account_id, event_type)` from `006`. Unique constraint
`uq_contract_events_tx_event_ledger (tx_hash, event_type, ledger_seq)` from `007`.

### `ingest_dead_letters` — failed ingest payloads (`008`, tightened by `009`)

| Column           | Type          | Notes                                            |
| ---------------- | ------------- | ------------------------------------------------ |
| `id`             | `UUID`        | Primary key, `gen_random_uuid()`                 |
| `stream`         | `VARCHAR(64)` | Ingestion stream the event came from             |
| `ledger_seq`     | `BIGINT`      | Ledger of the failed event                       |
| `tx_hash`        | `VARCHAR(64)` | Transaction hash, `''` when the failure had none |
| `contract_id`    | `VARCHAR(56)` | Emitting contract, `''` when unknown             |
| `error_message`  | `TEXT`        | Normalisation failure                            |
| `raw_payload`    | `JSONB`       | Raw event, kept so the failure is recoverable    |
| `created_at`     | `TIMESTAMPTZ` | Defaults to `NOW()`                              |
| `reprocessed_at` | `TIMESTAMPTZ` | `NULL` until reprocessed                         |

Indexes: `(stream, ledger_seq DESC)` and a partial
`(created_at) WHERE reprocessed_at IS NULL` for the unprocessed queue. Unique
constraint `uq_ingest_dead_letters_stream_ledger_tx (stream, ledger_seq, tx_hash)`
from `009`, so a retried batch cannot queue the same failure twice.

### Migration history

| Version | File                                                | Change                                                       |
| ------- | --------------------------------------------------- | ------------------------------------------------------------ |
| 1       | `001_create_account_activity_table.sql`             | `account_activity` + four indexes                            |
| 2       | `002_create_ingest_checkpoints_table.sql`           | `ingest_checkpoints`                                         |
| 3       | `003_add_asset_code_issuer_to_account_activity.sql` | `asset_code` / `asset_issuer` + backfill from `asset`        |
| 4       | `004_create_contract_events_table.sql`              | `contract_events` + five indexes                             |
| 5       | `005_create_schema_migrations_table.sql`            | `schema_migrations` ledger + backfill of versions 1–5        |
| 6       | `006_add_account_id_to_contract_events.sql`         | `contract_events.account_id` backfill (`NOT NULL`) + indexes |
| 7       | `007_add_ingest_idempotency_constraints.sql`        | de-duplicate then add unique keys on both event tables       |
| 8       | `008_create_ingest_dead_letters_table.sql`          | `ingest_dead_letters` + partial unprocessed index            |
| 9       | `009_add_dead_letter_idempotency.sql`               | de-duplicate then add unique key on `ingest_dead_letters`    |

`EXPECTED_SCHEMA_VERSION` in
[`src/repositories/migrations.rs`](src/repositories/migrations.rs) tracks the
highest version here; bump it in the same commit that adds a migration file,
otherwise `/health` reports `ahead` for a database that is simply current.

## Adding a migration

1. **Pick the next sequence number.** The filename convention is enforced by
   `pnpm indexer:lint-migrations` (`scripts/lint-migrations.mjs`):
   `NNN_snake_case_description.sql`, exactly three zero-padded digits, unique
   sequence. A duplicate sequence silently broke migration lint once — the
   `006` file originally shipped as a second `005` — so run the lint, don't count
   by hand.
2. **Write the SQL.** Prefer `IF NOT EXISTS` / `ON CONFLICT` where the statement
   supports it, and de-duplicate before adding a `UNIQUE` constraint (that's the
   pattern `007` and `009` use). Never drop a column that a released API returns.
3. **Append the ledger insert** shown above, using the same number and name as
   the file.
4. **Bump `EXPECTED_SCHEMA_VERSION`** to the new version.
5. **Keep SQLx metadata in sync** — if the change affects the shape of a query the
   crate compiles against, regenerate `.sqlx/` with `cargo sqlx prepare` so
   offline builds keep working (see the [README](README.md#offline-build-no-database_url-required)).
6. **Add tests** for the behaviour the migration enables, and run the checks in
   [Before you push](../../AGENTS.md#before-you-push--run-what-ci-runs) — `cargo fmt --check`,
   `cargo clippy -- -D warnings` and `cargo test` inside `services/indexer/`.

## Local development setup

### 1. Start a local PostgreSQL database

Using Docker:

```bash
docker run -d --name ancore-indexer-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ancore_dev \
  -p 5432:5432 \
  postgres:16
```

Or via Docker Compose (from repo root):

```bash
docker-compose up -d postgres
```

### 2. Set DATABASE_URL environment variable

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ancore_dev"
```

### 3. Apply all migrations

```bash
# From repo root
for f in services/indexer/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

### 4. Verify migration state

```bash
psql "$DATABASE_URL" -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"
```

Expected output:

```
 version |                  name                  |         applied_at
---------+----------------------------------------+----------------------------
       1 | create_account_activity_table          | 2024-01-15 10:00:00.000000
       2 | create_ingest_checkpoints_table        | 2024-01-15 10:00:00.000000
       3 | add_asset_code_issuer_to_account_activity | 2024-01-15 10:00:00.000000
       4 | create_contract_events_table           | 2024-01-15 10:00:00.000000
       5 | create_schema_migrations_table         | 2024-01-15 10:00:00.000000
       6 | add_account_id_to_contract_events      | 2024-01-15 10:00:00.000000
       7 | add_ingest_idempotency_constraints     | 2024-01-15 10:00:00.000000
       8 | create_ingest_dead_letters_table       | 2024-01-15 10:00:00.000000
       9 | add_dead_letter_idempotency            | 2024-01-15 10:00:00.000000
(9 rows)
```

### 5. Regenerate SQLx offline cache (if queries changed)

When adding or modifying queries in the Rust codebase:

```bash
cd services/indexer
cargo sqlx prepare -- --lib
git add .sqlx/
```

This step is only needed when SQL queries in the Rust code are added or modified. See
[README § Offline Build](README.md#offline-build-no-database_url-required) for details.

## Applying and verifying

```bash
# Apply every migration to a scratch database and smoke-test the down/up cycle
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ancore_test \
  bash services/indexer/scripts/check-migrations.sh

# Same, but also fail on drift against a golden schema dump
# SCHEMA_DUMP_FILE is optional — CI runs the script without one.
SCHEMA_DUMP_FILE=/path/to/golden_schema.sql \
  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ancore_test \
  bash services/indexer/scripts/check-migrations.sh

# Filename convention / duplicate sequence check (no database needed)
pnpm indexer:lint-migrations
```

`check-migrations.sh` applies every file in order, optionally diffs the result
against a golden `pg_dump`, then drops the application tables and re-applies
everything to prove the schema is reproducible (`SKIP_DOWN=1` skips that second
pass).

After applying, verify the live state rather than trusting the console output:

```bash
psql "$DATABASE_URL" -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version"
curl -s localhost:8080/health | jq '{schema_version, expected_schema_version, migration_status}'
```

`migration_status` must be `up_to_date`. `pending` means migrations have not
finished; `ahead` means the binary lags the database; `unknown` means the ledger
is missing or empty.

## Rollback and recovery

There are no down migrations, and an applied file is never edited. Recovery is a
new, higher-numbered migration that compensates — that is how `006` and `009`
replaced their predecessors, and it is the procedure in
[Indexer README § Rollback Procedure](README.md#rollback-procedure).

Three situations worth knowing apart:

- **Bad migration, schema only** — write the compensating migration, apply it, and
  confirm with `/health` that `migration_status` is `up_to_date` again.
- **Bad migration, data rewritten** — restore the `pg_dump` taken before the
  deploy and re-apply with the fixed file; do not try to reverse a `DELETE`.
- **Ledger disagrees with the schema** — deleting a ledger row makes the file run
  again, which only works for genuinely idempotent files (see
  [How migrations are applied](#how-migrations-are-applied)). Check the ledger
  before assuming a migration did not run.

Events that fail to normalise while a migration is in flight are written to
`ingest_dead_letters` rather than dropped; the
[backfill and dead-letter runbook](../../docs/ops/runbooks/indexer-backfill-and-dead-letter-reprocessing.md)
covers replaying them.

## Schema entity-relationship diagram

```
┌─────────────────────────┐
│   account_activity      │
├─────────────────────────┤
│ id (PK)                 │
│ account_id              │◄─── indexed for account queries
│ activity_type           │
│ amount                  │
│ asset                   │
│ asset_code              │
│ asset_issuer            │
│ counterparty            │
│ tx_hash                 │◄─── indexed, idempotency key with activity_type + ledger_seq
│ ledger_seq              │
│ created_at              │
│ metadata (JSONB)        │
└─────────────────────────┘

┌─────────────────────────┐
│   contract_events       │
├─────────────────────────┤
│ id (PK)                 │
│ contract_address        │◄─── indexed
│ account_id              │◄─── indexed for wallet lookups
│ event_type              │◄─── indexed
│ ledger_seq              │◄─── indexed DESC
│ timestamp               │◄─── indexed DESC
│ tx_hash                 │◄─── idempotency key with event_type + ledger_seq
│ data (JSONB)            │
└─────────────────────────┘

┌─────────────────────────┐
│  ingest_checkpoints     │
├─────────────────────────┤
│ stream (PK)             │
│ last_ledger_seq         │
│ updated_at              │
└─────────────────────────┘

┌─────────────────────────┐
│  ingest_dead_letters    │
├─────────────────────────┤
│ id (PK)                 │
│ stream                  │◄─┐
│ ledger_seq              │◄─┼── composite idempotency key
│ tx_hash                 │◄─┘
│ contract_id             │
│ error_message           │
│ raw_payload (JSONB)     │
│ created_at              │
│ reprocessed_at          │◄─── partial index WHERE NULL
└─────────────────────────┘

┌─────────────────────────┐
│  schema_migrations      │
├─────────────────────────┤
│ version (PK)            │
│ name                    │
│ applied_at              │
└─────────────────────────┘
```

**Key relationships:**

- `account_activity` and `contract_events` are independent event logs with their own idempotency constraints
- `ingest_checkpoints` tracks ingestion progress; one row per stream
- `ingest_dead_letters` stores normalisation failures for replay
- `schema_migrations` is the migration ledger read by `/health`

## SQLx commands reference

The indexer uses SQLx for compile-time query verification. When working with migrations
that change query shapes, regenerate the offline cache:

### Install sqlx-cli

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

### Regenerate query metadata

```bash
cd services/indexer
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/ancore_dev" \
  cargo sqlx prepare -- --lib
```

This writes JSON metadata to `.sqlx/` that describes each query's parameters and result columns.
Commit these files alongside query changes.

### Run migrations with sqlx-cli (alternative to psql)

```bash
# Run all pending migrations
cd services/indexer
sqlx migrate run

# Revert last migration (not recommended in production)
sqlx migrate revert
```

**Note:** The project convention is to apply migrations with `psql` rather than `sqlx migrate`,
so every migration file is written as plain SQL without SQLx-specific syntax.
