-- Migration 002: Scheduled/recurring transfer durable storage
-- Replaces the in-memory ScheduledTransferStore with Postgres-backed tables.
-- All lifecycle operations in ScheduledTransferService remain idempotent.

-- ── Scheduled transfers ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            TEXT NOT NULL,
  caller_id             TEXT NOT NULL,
  to_address            TEXT NOT NULL,
  amount                TEXT NOT NULL,
  asset                 TEXT NOT NULL DEFAULT 'XLM',
  frequency             TEXT NOT NULL CHECK (frequency IN ('once','daily','weekly','monthly')),
  status                TEXT NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','paused','cancelled','completed')),
  start_at              TIMESTAMPTZ NOT NULL,
  next_run_at           TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ,
  note                  TEXT,
  user_approved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  relay_payload         JSONB NOT NULL,
  consecutive_failures  INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_execution_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_transfers_account
  ON scheduled_transfers (account_id, caller_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_transfers_due
  ON scheduled_transfers (next_run_at)
  WHERE status = 'active';

-- ── Execution logs ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_transfer_executions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_transfer_id   UUID NOT NULL REFERENCES scheduled_transfers(id) ON DELETE CASCADE,
  executed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome                 TEXT NOT NULL CHECK (outcome IN ('success','failed')),
  transaction_id          TEXT,
  error                   TEXT
);

CREATE INDEX IF NOT EXISTS idx_ste_transfer_id
  ON scheduled_transfer_executions (scheduled_transfer_id, executed_at DESC);

-- ── Lease locks (distributed mutex per transfer) ───────────────────────────────
-- Prevents two worker instances from executing the same transfer concurrently.

CREATE TABLE IF NOT EXISTS scheduled_transfer_leases (
  transfer_id   UUID PRIMARY KEY REFERENCES scheduled_transfers(id) ON DELETE CASCADE,
  worker_id     TEXT NOT NULL,
  acquired_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stl_expires_at
  ON scheduled_transfer_leases (expires_at);

-- ── Failure notifications log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scheduled_transfer_notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_transfer_id UUID NOT NULL REFERENCES scheduled_transfers(id) ON DELETE CASCADE,
  notified_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notification_type     TEXT NOT NULL,
  -- consecutive_failure | max_failures_reached | cancelled_after_failure
  payload               JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_stn_transfer_id
  ON scheduled_transfer_notifications (scheduled_transfer_id, notified_at DESC);
