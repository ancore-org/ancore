-- Add account_id column to contract_events for wallet-scoped queries.
-- Backfill existing rows: account_id = contract_address (same entity for AA events).
ALTER TABLE contract_events ADD COLUMN account_id VARCHAR(56);

UPDATE contract_events SET account_id = contract_address WHERE account_id IS NULL;

ALTER TABLE contract_events ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX idx_contract_events_account_id ON contract_events (account_id);
CREATE INDEX idx_contract_events_account_id_event_type ON contract_events (account_id, event_type);
