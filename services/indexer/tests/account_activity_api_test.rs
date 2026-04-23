use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use ancore_indexer::{api::account_activity, repositories::account_activity::ActivityRecord};

async fn setup_test_app() -> (Router, PgPool) {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string());

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    // Clean up any existing data
    sqlx::query("TRUNCATE TABLE account_activity CASCADE")
        .execute(&pool)
        .await
        .expect("Failed to truncate table");

    let app = Router::new()
        .route(
            "/api/v1/accounts/:account_id/activity",
            axum::routing::get(account_activity::list_handler),
        )
        .route(
            "/api/v1/accounts/:account_id/activity/:activity_id",
            axum::routing::get(account_activity::get_by_id_handler),
        )
        .route(
            "/api/v1/accounts/:account_id/activity/types",
            axum::routing::get(account_activity::list_types_handler),
        )
        .with_state(pool.clone());

    (app, pool)
}

async fn insert_test_activity(
    pool: &PgPool,
    account_id: &str,
    activity_type: &str,
    ledger_seq: i64,
    created_at: chrono::DateTime<chrono::Utc>,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO account_activity (id, account_id, activity_type, amount, asset, counterparty, tx_hash, ledger_seq, created_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)"
    )
    .bind(id)
    .bind(account_id)
    .bind(activity_type)
    .bind("100.0000000")
    .bind("USDC:GABCD...")
    .bind("GXYZ...")
    .bind("abc123...")
    .bind(ledger_seq)
    .bind(created_at)
    .bind(serde_json::json!({}))
    .execute(pool)
    .await
    .expect("Failed to insert test activity");

    id
}

#[tokio::test]
#[ignore]
async fn integration_test_list_activity_happy_path() {
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc::with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Seed DB with activity records
    for i in 0..5 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + chrono::Duration::seconds(i)).await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["data"].is_array());
    assert_eq!(json["data"].as_array().unwrap().len(), 5);
    assert!(json["pagination"].is_object());
    assert!(json["pagination"]["has_next_page"].is_boolean());
    assert!(json["pagination"]["count"].is_number());
}

#[tokio::test]
#[ignore]
async fn integration_test_list_with_all_filters() {
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc::with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Seed mixed records
    insert_test_activity(&pool, account_id, "payment", 100, base_time).await;
    insert_test_activity(&pool, account_id, "trade", 150, base_time + chrono::Duration::hours(1)).await;
    insert_test_activity(&pool, account_id, "payment", 200, base_time + chrono::Duration::hours(2)).await;

    let uri = format!(
        "/api/v1/accounts/{}/activity?activity_type=payment&ledger_min=100&ledger_max=200",
        account_id
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
#[ignore]
async fn integration_test_pagination_forward() {
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc::with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Seed 25 records
    for i in 0..25 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + chrono::Duration::seconds(i)).await;
    }

    // Page 1
    let response1 = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity?limit=10", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response1.status(), StatusCode::OK);
    let body1 = hyper::body::to_bytes(response1.into_body())
        .await
        .unwrap();
    let json1: serde_json::Value = serde_json::from_slice(&body1).unwrap();

    assert_eq!(json1["data"].as_array().unwrap().len(), 10);
    assert!(json1["pagination"]["has_next_page"].as_bool().unwrap());
    let next_cursor = json1["pagination"]["next_cursor"].as_str().unwrap();

    // Page 2 with cursor
    let uri2 = format!(
        "/api/v1/accounts/{}/activity?limit=10&cursor_after={}",
        account_id, next_cursor
    );
    let response2 = app
        .oneshot(Request::builder().uri(&uri2).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::OK);
    let body2 = hyper::body::to_bytes(response2.into_body())
        .await
        .unwrap();
    let json2: serde_json::Value = serde_json::from_slice(&body2).unwrap();

    assert_eq!(json2["data"].as_array().unwrap().len(), 10);
}

#[tokio::test]
#[ignore]
async fn integration_test_invalid_cursor_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?cursor_after=not-a-valid-cursor",
                    account_id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["error"], "invalid_cursor");
}

#[tokio::test]
#[ignore]
async fn integration_test_both_cursors_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?cursor_after=abc&cursor_before=def",
                    account_id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["error"], "invalid_filter");
}

#[tokio::test]
#[ignore]
async fn integration_test_invalid_limit_clamped() {
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc::with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Seed 150 records
    for i in 0..150 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + chrono::Duration::seconds(i)).await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity?limit=500", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Should be clamped to MAX_LIMIT (100)
    assert!(json["data"].as_array().unwrap().len() <= 100);
}

#[tokio::test]
#[ignore]
async fn integration_test_get_by_id_found() {
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc::with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    let id = insert_test_activity(&pool, account_id, "payment", 1000, base_time).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity/{}",
                    account_id, id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"]["id"], id.to_string());
    assert_eq!(json["data"]["account_id"], account_id);
}

#[tokio::test]
#[ignore]
async fn integration_test_get_by_id_not_found() {
    let (app, _pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let random_id = Uuid::new_v4();

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity/{}",
                    account_id, random_id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
#[ignore]
async fn integration_test_account_not_found_returns_empty() {
    let (app, _pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 0);
}

#[tokio::test]
#[ignore]
async fn integration_test_get_types() {
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc::with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Seed records with multiple types
    insert_test_activity(&pool, account_id, "payment", 1000, base_time).await;
    insert_test_activity(&pool, account_id, "trade", 1001, base_time + chrono::Duration::seconds(1)).await;
    insert_test_activity(&pool, account_id, "trust_change", 1002, base_time + chrono::Duration::seconds(2)).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity/types", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = hyper::body::to_bytes(response.into_body())
        .await
        .unwrap();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 3);
}

#[tokio::test]
#[ignore]
async fn integration_test_invalid_account_id_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let account_id = "invalid"; // Not a valid Stellar public key

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[ignore]
async fn integration_test_invalid_ledger_range_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?ledger_min=200&ledger_max=100",
                    account_id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}
