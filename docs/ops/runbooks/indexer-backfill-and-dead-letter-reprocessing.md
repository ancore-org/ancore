# Runbook: Indexer Backfill and Dead-Letter Reprocessing

## Goal
Recover missing or previously-failed indexed events after an incident (indexer downtime, a
missed ledger range, an RPC outage) or a normalisation bug fix, using the `ancore-indexer`
binary's `backfill` and `reprocess-dead-letters` subcommands.

## Prerequisites
- Shell access to a host with `DATABASE_URL` pointed at the production/staging Postgres instance
  (or `cargo run` from a checkout with the same env configured).
- For `backfill`: `SOROBAN_RPC_URL` and `SOROBAN_CONTRACT_IDS` — the same values the live ingest
  worker is configured with (check the running worker's environment/deployment config).
- Read access to `ingest_checkpoints` and `ingest_dead_letters` to confirm before/after state.

## When to use which command

| Situation | Command |
|-----------|---------|
| A ledger range was never ingested (indexer was down, RPC outage, new contract deployed retroactively) | `backfill` |
| Events were ingested but failed `normalise()` and are sitting in `ingest_dead_letters` (a normalisation bug that's since been fixed) | `reprocess-dead-letters` |

Both commands are **safe to run alongside a live, running ingest worker**: neither one reads or
writes `ingest_checkpoints`. `backfill` takes its ledger range directly from `--from`/`--to`, not
from the checkpoint cursor; `reprocess-dead-letters` replays stored rows by id, not by ledger
position. Event writes for both go through the same `PostgresEventSink` the live worker uses,
which is idempotent (`ON CONFLICT DO NOTHING` on `(tx_hash, event_type/activity_type,
ledger_seq)`), so re-running either command over an overlapping range/row set is always safe.

## Steps

### 1. Identify the gap or the pending dead letters

For a missed ledger range:
```sql
SELECT stream, last_ledger_seq, updated_at FROM ingest_checkpoints;
```
Compare against the current network ledger to find the gap.

For dead letters:
```sql
SELECT id, stream, ledger_seq, error_message, created_at
FROM ingest_dead_letters
WHERE reprocessed_at IS NULL
ORDER BY created_at ASC;
```

### 2a. Run a backfill

```bash
export DATABASE_URL="postgresql://..."
export SOROBAN_RPC_URL="https://soroban-rpc.example.com"
export SOROBAN_CONTRACT_IDS="CCONTRACT1...,CCONTRACT2..."

cargo run --bin ancore-indexer -- backfill --from <FROM_LEDGER> --to <TO_LEDGER> --batch-size 500
```

Prints `BackfillStats { fetched, out_of_range, errors, persisted }` on completion. `errors > 0`
means some events in range still fail to normalise — see step 2b.

### 2b. Reprocess dead letters (after shipping a fix)

```bash
export DATABASE_URL="postgresql://..."
cargo run --bin ancore-indexer -- reprocess-dead-letters --limit 100
```

Prints `ReprocessStats { candidates, normalise_failed, persisted }`. If `normalise_failed > 0`,
those rows are still broken and remain pending — re-check the error messages from step 1 and
fix the underlying issue before retrying.

### 3. Verify completeness

```sql
-- Events by type in the backfilled range
SELECT event_type, COUNT(*) FROM contract_events
WHERE ledger_seq BETWEEN <FROM_LEDGER> AND <TO_LEDGER>
GROUP BY event_type ORDER BY count DESC;

-- Remaining pending dead letters
SELECT COUNT(*) FROM ingest_dead_letters WHERE reprocessed_at IS NULL;
```

See `services/indexer/docs/BACKFILL.md` for the full gap-detection query and event
classification reference.

### 4. No further action needed

Neither command touches `ingest_checkpoints`, so the live `IngestWorker` (if running) is
completely unaffected — it keeps resuming from its own cursor as normal.
