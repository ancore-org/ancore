-- Add account_id column to contract_events for wallet-scoped queries.
-- Backfill existing rows: account_id = contract_address (same entity for AA events).
ALTER TABLE contract_events ADD COLUMN account_id VARCHAR(56);

UPDATE contract_events SET account_id = contract_address WHERE account_id IS NULL;

ALTER TABLE contract_events ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX idx_contract_events_account_id ON contract_events (account_id);
CREATE INDEX idx_contract_events_account_id_event_type ON contract_events (account_id, event_type);

-- This file previously shared the "005" sequence number with
-- 005_create_schema_migrations_table.sql (a real bug — scripts/lint-migrations.mjs
-- rejects duplicate sequence numbers, so CI's migration lint was broken until this
-- rename). Renumbered to 006 and given its own ledger entry, per the convention
-- 005_create_schema_migrations_table.sql establishes ("every migration file from
-- here on MUST end with its own INSERT into this table").
INSERT INTO schema_migrations (version, name)
VALUES (6, 'add_account_id_to_contract_events')
ON CONFLICT (version) DO NOTHING;
