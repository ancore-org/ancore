CREATE TABLE IF NOT EXISTS contract_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_address VARCHAR(56) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    ledger_seq BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    tx_hash VARCHAR(64) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_contract_events_contract_address
    ON contract_events (contract_address);
CREATE INDEX IF NOT EXISTS idx_contract_events_event_type
    ON contract_events (event_type);
CREATE INDEX IF NOT EXISTS idx_contract_events_contract_address_event_type
    ON contract_events (contract_address, event_type);
CREATE INDEX IF NOT EXISTS idx_contract_events_ledger_seq
    ON contract_events (ledger_seq DESC);
CREATE INDEX IF NOT EXISTS idx_contract_events_timestamp
    ON contract_events (timestamp DESC);
