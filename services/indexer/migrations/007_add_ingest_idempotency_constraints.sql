-- Idempotent ingestion (issue #996): both event tables were previously
-- missing the unique constraint their own insert paths need to be safely
-- re-run. docs/BACKFILL.md already documents "the backfill uses the same
-- ON CONFLICT DO NOTHING semantics as real-time ingestion... reprocessing
-- the same ledger range is safe" — that was aspirational, not actual: the
-- insert_contract_event/insert_activity repository functions had no
-- ON CONFLICT clause, so replaying the same event (a worker restart, or a
-- backfill range that overlaps already-ingested ledgers) inserted a
-- duplicate row rather than a no-op.
--
-- Dedup first: keep the earliest-inserted row for each key, since that's
-- the one every existing reference (webhooks already sent, etc.) would
-- have pointed at.
DELETE FROM contract_events a
USING contract_events b
WHERE a.id > b.id
  AND a.tx_hash = b.tx_hash
  AND a.event_type = b.event_type
  AND a.ledger_seq = b.ledger_seq;

ALTER TABLE contract_events
    ADD CONSTRAINT uq_contract_events_tx_event_ledger UNIQUE (tx_hash, event_type, ledger_seq);

DELETE FROM account_activity a
USING account_activity b
WHERE a.id > b.id
  AND a.tx_hash = b.tx_hash
  AND a.activity_type = b.activity_type
  AND a.ledger_seq = b.ledger_seq;

ALTER TABLE account_activity
    ADD CONSTRAINT uq_account_activity_tx_type_ledger UNIQUE (tx_hash, activity_type, ledger_seq);

INSERT INTO schema_migrations (version, name)
VALUES (7, 'add_ingest_idempotency_constraints')
ON CONFLICT (version) DO NOTHING;
