-- Dead-letter queue for raw events that fail normalisation.
--
-- When the ingest worker cannot normalise an event it writes the raw payload
-- here so the failure is recoverable after a fix, instead of being silently
-- dropped while the checkpoint advances.
CREATE TABLE IF NOT EXISTS ingest_dead_letters (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    stream          VARCHAR(64)  NOT NULL,
    ledger_seq      BIGINT       NOT NULL,
    tx_hash         VARCHAR(64)  NOT NULL DEFAULT '',
    contract_id     VARCHAR(56)  NOT NULL DEFAULT '',
    error_message   TEXT         NOT NULL,
    raw_payload     JSONB        NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    reprocessed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_stream_ledger
    ON ingest_dead_letters (stream, ledger_seq DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_unprocessed
    ON ingest_dead_letters (created_at)
    WHERE reprocessed_at IS NULL;

INSERT INTO schema_migrations (version, name)
VALUES (8, 'create_ingest_dead_letters_table')
ON CONFLICT (version) DO NOTHING;
