//! Integration tests for the migration fields on GET /health.
//!
//! These require a live Postgres and are `#[ignore]`d like the other DB-backed
//! suites in this crate. Run them with:
//!
//! ```bash
//! TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ancore_test \
//!   cargo test --test health_migration_test -- --ignored
//! ```
//!
//! The classification logic itself is covered by unit tests in
//! `src/repositories/migrations.rs` and `src/api/health.rs`, which run without
//! a database.

use axum::{
    body::{Body, Bytes},
    http::{Request, StatusCode},
    Router,
};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::PgPool;
use tower::ServiceExt;

use ancore_indexer::api::health;
use ancore_indexer::repositories::migrations::{
    fetch_migration_state, MigrationStatus, EXPECTED_SCHEMA_VERSION,
};

async fn response_body_bytes(response: axum::response::Response) -> Bytes {
    response.into_body().collect().await.unwrap().to_bytes()
}

async fn setup() -> (Router, PgPool) {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string()
    });

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    let app = Router::new()
        .route("/health", axum::routing::get(health::health_handler))
        .with_state(pool.clone());

    (app, pool)
}

async fn get_health(app: &Router) -> Value {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    serde_json::from_slice(&response_body_bytes(response).await).unwrap()
}

#[tokio::test]
#[ignore]
async fn health_reports_schema_version_from_migration_ledger() {
    let (app, _pool) = setup().await;
    let body = get_health(&app).await;

    assert_eq!(
        body["expected_schema_version"].as_i64(),
        Some(EXPECTED_SCHEMA_VERSION as i64)
    );
    assert_eq!(
        body["schema_version"].as_i64(),
        Some(EXPECTED_SCHEMA_VERSION as i64),
        "test database should be migrated to the version this build expects"
    );
    assert_eq!(body["migration_status"], "up_to_date");
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
#[ignore]
async fn health_reports_the_latest_applied_migration() {
    let (app, _pool) = setup().await;
    let body = get_health(&app).await;

    assert!(
        body["latest_migration"].is_string(),
        "expected a migration name, got {}",
        body["latest_migration"]
    );
    assert!(
        body["migration_applied_at"].is_string(),
        "expected an applied_at timestamp, got {}",
        body["migration_applied_at"]
    );
    assert!(
        body["applied_migrations"].as_i64().unwrap_or(0) >= EXPECTED_SCHEMA_VERSION as i64,
        "ledger should record every migration up to the expected version"
    );
}

#[tokio::test]
#[ignore]
async fn health_keeps_reporting_ledger_lag_fields() {
    let (app, _pool) = setup().await;
    let body = get_health(&app).await;

    // The migration fields are additive — the pre-existing lag contract must
    // still hold for anything already scraping /health.
    for field in [
        "timestamp",
        "status",
        "latest_indexed_ledger",
        "chain_head",
        "lag_blocks",
        "lag_seconds",
    ] {
        assert!(!body[field].is_null(), "missing /health field: {field}");
    }
}

#[tokio::test]
#[ignore]
async fn migration_state_matches_the_expected_version() {
    let (_app, pool) = setup().await;

    let state = fetch_migration_state(&pool)
        .await
        .expect("reading the migration ledger should succeed");

    assert_eq!(state.schema_version, Some(EXPECTED_SCHEMA_VERSION));
    assert_eq!(state.status(), MigrationStatus::UpToDate);
    assert!(state.applied_count >= EXPECTED_SCHEMA_VERSION as i64);
}
