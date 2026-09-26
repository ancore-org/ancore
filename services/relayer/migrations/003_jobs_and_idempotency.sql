-- Migration 003: Persistent JobQueue and IdempotencyStore tables
-- Provides durable storage across relayer restarts and shared state across
-- multiple relayer instances behind a load balancer.

-- ── Job Queue ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key   TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('relay_execute', 'add_session_key', 'revoke_session_key')),
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
  attempts          INT NOT NULL DEFAULT 0,
  max_attempts      INT NOT NULL DEFAULT 5,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_after       TIMESTAMPTZ,
  last_error        TEXT
);

-- Partial unique index to enforce duplicate suppression for active (non-terminal) jobs
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_active_idempotency
  ON jobs (idempotency_key)
  WHERE status NOT IN ('completed', 'dead');

-- Index for FIFO queue dequeue polling
CREATE INDEX IF NOT EXISTS idx_jobs_dequeue
  ON jobs (created_at ASC)
  WHERE status = 'pending';

-- Index for dead letter query and status lookups
CREATE INDEX IF NOT EXISTS idx_jobs_status
  ON jobs (status);

-- ── Idempotency Store ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         TEXT PRIMARY KEY,
  status_code INT NOT NULL,
  body        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at
  ON idempotency_keys (expires_at);
