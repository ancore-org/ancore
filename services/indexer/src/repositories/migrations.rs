//! Read access to the `schema_migrations` ledger.
//!
//! The ledger is written by the SQL files in `migrations/` (see
//! `005_create_schema_migrations_table.sql`). It exists so operators can ask a
//! running indexer which schema version it is actually serving, rather than
//! inferring it from the deployed image tag.

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{PgPool, Row};

/// Schema version this build of the indexer expects the database to be at.
///
/// Bump this in the same commit that adds a migration file — it is the
/// reference point `/health` compares the live ledger against.
pub const EXPECTED_SCHEMA_VERSION: i32 = 5;

/// Where the database stands relative to [`EXPECTED_SCHEMA_VERSION`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MigrationStatus {
    /// Applied version matches what this build expects. Safe to serve.
    UpToDate,
    /// Database is behind — migrations have not finished running yet.
    Pending,
    /// Database is ahead — a newer indexer has migrated it, this one is stale.
    Ahead,
    /// The ledger table is missing. Either migrations have never run, or the
    /// database predates `005_create_schema_migrations_table.sql`.
    Unknown,
}

impl MigrationStatus {
    /// Classify an applied version against [`EXPECTED_SCHEMA_VERSION`].
    pub fn classify(applied: Option<i32>) -> Self {
        match applied {
            None => MigrationStatus::Unknown,
            Some(v) if v == EXPECTED_SCHEMA_VERSION => MigrationStatus::UpToDate,
            Some(v) if v < EXPECTED_SCHEMA_VERSION => MigrationStatus::Pending,
            Some(_) => MigrationStatus::Ahead,
        }
    }

    /// Whether this state should be treated as healthy for deploy gating.
    pub fn is_healthy(self) -> bool {
        matches!(self, MigrationStatus::UpToDate)
    }
}

/// Snapshot of the migration ledger at a point in time.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationState {
    /// Highest applied migration version, or `None` when the ledger is missing.
    pub schema_version: Option<i32>,
    /// Name of the highest applied migration.
    pub latest_migration: Option<String>,
    /// When the highest applied migration ran.
    pub applied_at: Option<DateTime<Utc>>,
    /// Total number of rows in the ledger.
    pub applied_count: i64,
}

impl MigrationState {
    /// State reported when the ledger table does not exist.
    pub fn unknown() -> Self {
        Self {
            schema_version: None,
            latest_migration: None,
            applied_at: None,
            applied_count: 0,
        }
    }

    /// Classification of this state against [`EXPECTED_SCHEMA_VERSION`].
    pub fn status(&self) -> MigrationStatus {
        MigrationStatus::classify(self.schema_version)
    }
}

/// Read the migration ledger.
///
/// A missing `schema_migrations` table is not an error — it is reported as
/// [`MigrationState::unknown`], which `/health` surfaces as
/// [`MigrationStatus::Unknown`]. Every other database error propagates, so a
/// genuinely broken connection still fails the health check loudly.
pub async fn fetch_migration_state(db: &PgPool) -> Result<MigrationState, sqlx::Error> {
    let ledger_exists: bool =
        sqlx::query_scalar("SELECT to_regclass('schema_migrations') IS NOT NULL")
            .fetch_one(db)
            .await?;

    if !ledger_exists {
        return Ok(MigrationState::unknown());
    }

    let row = sqlx::query(
        "SELECT \
            (SELECT COUNT(*) FROM schema_migrations) AS applied_count, \
            version, name, applied_at \
         FROM schema_migrations ORDER BY version DESC LIMIT 1",
    )
    .fetch_optional(db)
    .await?;

    // The table exists but is empty — treat it the same as a missing ledger,
    // since neither tells us which schema is live.
    let Some(row) = row else {
        return Ok(MigrationState::unknown());
    };

    Ok(MigrationState {
        schema_version: Some(row.try_get("version")?),
        latest_migration: Some(row.try_get("name")?),
        applied_at: Some(row.try_get("applied_at")?),
        applied_count: row.try_get("applied_count")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_matching_version_as_up_to_date() {
        assert_eq!(
            MigrationStatus::classify(Some(EXPECTED_SCHEMA_VERSION)),
            MigrationStatus::UpToDate
        );
    }

    #[test]
    fn classifies_lower_version_as_pending() {
        assert_eq!(
            MigrationStatus::classify(Some(EXPECTED_SCHEMA_VERSION - 1)),
            MigrationStatus::Pending
        );
    }

    #[test]
    fn classifies_higher_version_as_ahead() {
        assert_eq!(
            MigrationStatus::classify(Some(EXPECTED_SCHEMA_VERSION + 1)),
            MigrationStatus::Ahead
        );
    }

    #[test]
    fn classifies_missing_ledger_as_unknown() {
        assert_eq!(MigrationStatus::classify(None), MigrationStatus::Unknown);
    }

    #[test]
    fn only_up_to_date_is_healthy() {
        assert!(MigrationStatus::UpToDate.is_healthy());
        assert!(!MigrationStatus::Pending.is_healthy());
        assert!(!MigrationStatus::Ahead.is_healthy());
        assert!(!MigrationStatus::Unknown.is_healthy());
    }

    #[test]
    fn unknown_state_reports_no_version() {
        let state = MigrationState::unknown();
        assert_eq!(state.schema_version, None);
        assert_eq!(state.applied_count, 0);
        assert_eq!(state.status(), MigrationStatus::Unknown);
    }

    #[test]
    fn serializes_status_as_snake_case() {
        assert_eq!(
            serde_json::to_string(&MigrationStatus::UpToDate).unwrap(),
            "\"up_to_date\""
        );
        assert_eq!(
            serde_json::to_string(&MigrationStatus::Unknown).unwrap(),
            "\"unknown\""
        );
    }
}
