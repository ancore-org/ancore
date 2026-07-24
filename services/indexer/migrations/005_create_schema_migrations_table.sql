-- Migration tracking table. The psql-based migration workflow has no
-- bookkeeping of its own, so each migration records itself here and the
-- /health endpoint reads this table to report schema version and pending
-- migrations for deploy verification.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(3) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill rows for migrations that predate tracking, then record this one.
-- Future migrations append their own INSERT line at the bottom of their file.
INSERT INTO schema_migrations (version) VALUES
    ('001'), ('002'), ('003'), ('004'), ('005')
ON CONFLICT (version) DO NOTHING;
