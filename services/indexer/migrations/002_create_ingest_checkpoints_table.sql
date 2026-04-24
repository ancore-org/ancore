-- Stores the last successfully processed ledger sequence per ingestion stream.
-- Allows the worker to resume from the correct position after a restart.
CREATE TABLE IF NOT EXISTS ingest_checkpoints (
    stream          VARCHAR(64)  PRIMARY KEY,
    last_ledger_seq BIGINT       NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
