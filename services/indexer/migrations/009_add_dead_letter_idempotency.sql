-- Retried ingest batches must not create duplicate dead-letter rows for the
-- same event. Empty transaction hashes are included deliberately: a failed
-- event with the same stream and ledger is still the same retry candidate.
DELETE FROM ingest_dead_letters a
USING ingest_dead_letters b
WHERE a.id > b.id
  AND a.stream = b.stream
  AND a.ledger_seq = b.ledger_seq
  AND a.tx_hash = b.tx_hash;

ALTER TABLE ingest_dead_letters
    ADD CONSTRAINT uq_ingest_dead_letters_stream_ledger_tx
    UNIQUE (stream, ledger_seq, tx_hash);

INSERT INTO schema_migrations (version, name)
VALUES (9, 'add_dead_letter_idempotency')
ON CONFLICT (version) DO NOTHING;
