-- Migration ledger.
--
-- Records which migrations have been applied so /health can report the live
-- schema version and whether the database is mid-migrate. Every migration file
-- from here on MUST end with its own INSERT into this table (see the backfill
-- below for the expected shape) — the ledger is what deploy verification reads.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill the migrations that shipped before the ledger existed. Databases
-- created from scratch and databases upgraded in place both end up with the
-- same rows.
INSERT INTO schema_migrations (version, name)
VALUES
    (1, 'create_account_activity_table'),
    (2, 'create_ingest_checkpoints_table'),
    (3, 'add_asset_code_issuer_to_account_activity'),
    (4, 'create_contract_events_table'),
    (5, 'create_schema_migrations_table')
ON CONFLICT (version) DO NOTHING;
