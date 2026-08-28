# Backfill Strategy for Historical Events

> Guide for reconciling historical contract events and account activity in the Ancore Indexer.

## Overview

The indexer's real-time ingestion pipeline processes events as they appear on the Stellar network.
However, there are scenarios where historical events must be reindexed:

1. **Schema migrations** — new columns or event types added after events were originally ingested
2. **Event classification fixes** — `classify_event()` updated to recognize new topics
3. **Data corrections** — fixing misclassified or missing events
4. **New contract deployments** — backfilling events from contracts deployed before the indexer ran

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  EventSource     │────▶│  normalise()     │────▶│  EventSink     │
│  (Horizon/RPC)   │     │  classify_event()│     │  (Postgres)    │
└─────────────────┘     └──────────────────┘     └────────────────┘
         ▲                                                │
         │           ┌──────────────────┐                 │
         └───────────│ BackfillCommand  │◀────────────────┘
                     │ (CLI / task)     │
                     └──────────────────┘
```

## Backfill Command

The `BackfillCommand` reprocesses a specific ledger range through the same pipeline used for
real-time ingestion:

```rust
use ancore_indexer::ingest::backfill::{BackfillCommand, BackfillConfig};

let cmd = BackfillCommand::new(
    BackfillConfig {
        from_ledger: 53_000_000,
        to_ledger: 53_100_000,
        batch_size: 500,
    },
    event_source,  // Horizon or RPC event source
    event_sink,    // Postgres-backed sink
);

let stats = cmd.run().await?;
println!(
    "backfilled {} events (fetched: {}, errors: {}, out_of_range: {})",
    stats.persisted, stats.fetched, stats.errors, stats.out_of_range
);
```

### BackfillConfig Fields

| Field | Type | Description |
|-------|------|-------------|
| `from_ledger` | `u32` | First ledger sequence to include (inclusive) |
| `to_ledger` | `u32` | Last ledger sequence to include (inclusive) |
| `batch_size` | `usize` | Number of ledgers to request per batch from the source |

### Constraints

- `from_ledger` must be `<= to_ledger`
- `batch_size` must be `> 0`
- Events outside `[from_ledger, to_ledger]` are silently skipped

### Idempotency

The backfill uses the same `ON CONFLICT DO NOTHING` semantics as real-time ingestion.
Reprocessing the same ledger range is safe — duplicate events are no-ops.

## Tables Affected

### `account_activity`

Classic operations (payments, transfers, contract invocations):

| Event Kind | `activity_type` | Notes |
|------------|-----------------|-------|
| `Transfer` | `transfer` | Native or credit asset transfers |
| `SessionKeyAdded` | `session_key_added` | Session key registered |
| `SessionKeyRevoked` | `session_key_revoked` | Session key revoked |
| `SessionKeyTtlRefreshed` | `session_key_ttl_refreshed` | Session key expiry extended |
| `RelayExecuted` | `relay_executed` | Meta-transaction executed |
| `Initialized` | `initialized` | Account contract deployed |
| `Upgraded` | `upgraded` | Contract WASM replaced |
| `Migrated` | `migrated` | Data-schema migration |
| `Unknown` | `unknown` | Unrecognized event topic |

### `contract_events`

Raw contract event storage with typed metadata:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `contract_address` | VARCHAR(56) | Emitting contract address |
| `account_id` | VARCHAR(56) | Wallet smart account (indexed) |
| `event_type` | VARCHAR(50) | Event classification |
| `ledger_seq` | BIGINT | Ledger sequence number |
| `timestamp` | TIMESTAMPTZ | Ledger close time |
| `tx_hash` | VARCHAR(64) | Transaction hash |
| `data` | JSONB | Event payload |

## Backfill Procedure

### 1. Identify the gap

Check the `ingest_checkpoints` table for the last processed ledger:

```sql
SELECT stream, last_ledger_seq, updated_at
FROM ingest_checkpoints;
```

Compare with the current network ledger from Horizon:

```
GET https://horizon.stellar.org/ledgers?order=desc&limit=1
```

### 2. Run the backfill

```bash
# Set environment — same RPC config the live ingest worker uses
export DATABASE_URL="postgresql://user:pass@localhost:5432/ancore_indexer"
export SOROBAN_RPC_URL="https://soroban-rpc.example.com"
export SOROBAN_CONTRACT_IDS="CCONTRACT1...,CCONTRACT2..."

# Run the backfill subcommand of the indexer binary
cargo run --bin ancore-indexer -- backfill --from 53000000 --to 53100000 --batch-size 500
```

This runs as a one-shot command against the real `RpcEventSource`/`PostgresEventSink` and exits
— it does not start the HTTP API or the live ingest worker. It also never reads or writes the
`ingest_checkpoints` table, so it's safe to run alongside a live worker without risk of
corrupting or regressing its resume cursor.

### 3. Verify completeness

```sql
-- Count events by type in the backfilled range
SELECT event_type, COUNT(*)
FROM contract_events
WHERE ledger_seq BETWEEN 53000000 AND 53100000
GROUP BY event_type
ORDER BY count DESC;

-- Check for gaps in ledger coverage
SELECT ledger_seq + 1 AS gap_start,
       next_ledger_seq - 1 AS gap_end
FROM (
    SELECT ledger_seq,
           LEAD(ledger_seq) OVER (ORDER BY ledger_seq) AS next_ledger_seq
    FROM contract_events
    WHERE ledger_seq BETWEEN 53000000 AND 53100000
) t
WHERE next_ledger_seq - ledger_seq > 1;
```

### 4. Restart real-time ingestion

After backfill completes, the real-time `IngestWorker` will automatically resume from the
checkpoint. No manual intervention is needed.

## Dead-Letter Reprocessing

Events that fail `normalise()` (e.g. missing `tx_hash`/`contract_id`) are written to
`ingest_dead_letters` instead of being silently dropped, so they can be recovered once the
underlying bug is fixed.

### 1. Inspect pending dead letters

```sql
SELECT id, stream, ledger_seq, error_message, created_at
FROM ingest_dead_letters
WHERE reprocessed_at IS NULL
ORDER BY created_at ASC;
```

### 2. Ship the fix, then reprocess

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/ancore_indexer"
cargo run --bin ancore-indexer -- reprocess-dead-letters --limit 100
```

Each pending row's stored raw payload is re-run through the same `normalise()` used by live
ingest and backfill. Rows that persist successfully are marked `reprocessed_at = NOW()`; rows
that still fail are left pending (not dropped) for another retry after a further fix. Like
backfill, this never touches `ingest_checkpoints` — it replays rows by id, not by ledger cursor.

### 3. Verify

```sql
SELECT COUNT(*) FROM ingest_dead_letters WHERE reprocessed_at IS NULL;
```

Re-run with a higher `--limit` (or repeatedly) until this reaches zero for the rows you expect
to have fixed.

## Event Classification Reference

The `classify_event()` function in `services/indexer/src/schema/canonical.rs` maps
Soroban event topic strings to `EventKind` variants:

| Topic String | EventKind | Contract Event |
|-------------|-----------|----------------|
| `transfer` | `Transfer` | Asset transfer |
| `initialized` | `Initialized` | Account deployment |
| `session_key_added` / `add_session_key` | `SessionKeyAdded` | Session key registered |
| `session_key_revoked` / `revoke_session_key` | `SessionKeyRevoked` | Session key revoked |
| `session_key_ttl_refreshed` | `SessionKeyTtlRefreshed` | TTL extended |
| `relay_executed` / `execute` | `RelayExecuted` | Meta-tx executed |
| `upgraded` | `Upgraded` | WASM replaced |
| `migrated` | `Migrated` | Schema migration |
| *(anything else)* | `Unknown` | Unrecognized |

## Wallet Integration

Both the extension and mobile wallet adapters fetch from two endpoints simultaneously:

1. `GET /api/v1/accounts/:id/activity` — classic operations
2. `GET /api/v1/contract-events?account=:id` — AA contract events

Results are merged, deduplicated by `tx_hash + event_type + id`, and sorted by timestamp DESC.
This ensures session key additions, revocations, and TTL refreshes appear in the unified
transaction history alongside payments and transfers.

## Troubleshooting

### Events missing after backfill

1. Check that the `classify_event()` function recognizes the event topic
2. Verify the event was fetched (check `stats.fetched > 0`)
3. Check for normalisation errors (`stats.errors > 0`)
4. Inspect the raw event topics in the Stellar RPC response

### Duplicate events

The pipeline is idempotent. If duplicates appear:
1. Check that `ON CONFLICT DO NOTHING` is applied in the sink
2. Verify the dedup key (`tx_hash + event_type`) is correct

### Performance

- Use `batch_size` of 500-1000 for optimal throughput
- Monitor the `ingest_checkpoint_lag` metric during backfill
- Backfill during low-traffic periods to avoid competing with real-time ingestion
