-- Create account_activity table for storing blockchain activity events
CREATE TABLE IF NOT EXISTS account_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id VARCHAR(56) NOT NULL,
    activity_type VARCHAR(50) NOT NULL,
    amount NUMERIC(20, 7),
    asset VARCHAR(100),
    counterparty VARCHAR(56),
    tx_hash VARCHAR(64) NOT NULL,
    ledger_seq BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Index for primary query pattern: account_id with time ordering
CREATE INDEX idx_account_activity_account_created ON account_activity (account_id, created_at DESC);

-- Index for filtered queries by activity type
CREATE INDEX idx_account_activity_account_type_created ON account_activity (account_id, activity_type, created_at DESC);

-- Index for ledger-range queries
CREATE INDEX idx_account_activity_account_ledger ON account_activity (account_id, ledger_seq DESC);

-- Index for transaction hash lookups
CREATE INDEX idx_account_activity_tx_hash ON account_activity (tx_hash);
