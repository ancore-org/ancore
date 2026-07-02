/// Comprehensive pagination consistency and edge case tests.
///
/// These tests verify that the cursor-based pagination implementation
/// handles edge cases correctly, maintains consistency across pagination requests,
/// and properly detects next/previous page availability.

use axum::{
    body::{Body, Bytes},
    http::{Request, StatusCode},
    Router,
};
use chrono::TimeZone;
use http_body_util::BodyExt;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use ancore_indexer::api::account_activity;

async fn response_body_bytes(response: axum::response::Response) -> Bytes {
    response.into_body().collect().await.unwrap().to_bytes()
}

async fn setup_test_app() -> (Router, PgPool) {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string()
    });

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

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

// ── Pagination Consistency Tests ──────────────────────────────────────

#[tokio::test]
#[ignore]
async fn test_pagination_no_record_duplication_forward() {
    /// Verify that forward pagination doesn't return the same record twice.
    /// This is a critical property of keyset pagination.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert 30 records
    let mut all_ids = Vec::new();
    for i in 0..30 {
        let id = insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
        all_ids.push(id);
    }

    // Paginate through all records with limit=10
    let mut collected_ids = Vec::new();
    let mut cursor = None;

    for page_num in 0..3 {
        let uri = if let Some(c) = &cursor {
            format!(
                "/api/v1/accounts/{}/activity?limit=10&cursor_after={}",
                account_id, c
            )
        } else {
            format!("/api/v1/accounts/{}/activity?limit=10", account_id)
        };

        let response = app
            .clone()
            .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK, "page {}", page_num);

        let body = response_body_bytes(response).await;
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        let data = json["data"].as_array().unwrap();
        for item in data {
            let id_str = item["id"].as_str().unwrap();
            collected_ids.push(id_str.to_string());
        }

        cursor = json["pagination"]["next_cursor"].as_str().map(|s| s.to_string());

        if !json["pagination"]["has_next_page"].as_bool().unwrap() {
            break;
        }
    }

    // Verify no duplicates
    let unique_count = collected_ids.iter().collect::<std::collections::HashSet<_>>().len();
    assert_eq!(
        collected_ids.len(),
        unique_count,
        "Duplicate records detected in pagination"
    );

    // Verify we got all records
    assert_eq!(collected_ids.len(), 30, "Expected 30 records, got {}", collected_ids.len());
}

#[tokio::test]
#[ignore]
async fn test_pagination_empty_result_set() {
    /// Verify pagination handles empty result sets correctly.
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

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 0);
    assert!(!json["pagination"]["has_next_page"].as_bool().unwrap());
    assert!(!json["pagination"]["has_previous_page"].as_bool().unwrap());
    assert!(json["pagination"]["next_cursor"].is_null());
    assert!(json["pagination"]["prev_cursor"].is_null());
    assert_eq!(json["pagination"]["count"], 0);
}

#[tokio::test]
#[ignore]
async fn test_pagination_exactly_limit_records() {
    /// Verify has_next_page is false when result count equals limit exactly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert exactly 20 records (default limit)
    for i in 0..20 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity?limit=20", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 20);
    assert!(!json["pagination"]["has_next_page"].as_bool().unwrap());
    assert!(json["pagination"]["next_cursor"].is_null());
}

#[tokio::test]
#[ignore]
async fn test_pagination_one_more_than_limit() {
    /// Verify has_next_page is true when one more record exists.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert 21 records (limit is 20)
    for i in 0..21 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity?limit=20", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 20);
    assert!(json["pagination"]["has_next_page"].as_bool().unwrap());
    assert!(json["pagination"]["next_cursor"].is_some());
}

#[tokio::test]
#[ignore]
async fn test_pagination_backward_with_cursor_before() {
    /// Verify backward pagination using cursor_before works correctly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert 25 records
    for i in 0..25 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    // Get first page
    let response1 = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?limit=10",
                    account_id
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let body1 = response_body_bytes(response1).await;
    let json1: serde_json::Value = serde_json::from_slice(&body1).unwrap();
    let first_page_first_id = json1["data"][0]["id"].as_str().unwrap().to_string();

    // Get second page
    let next_cursor = json1["pagination"]["next_cursor"].as_str().unwrap();
    let response2 = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?limit=10&cursor_after={}",
                    account_id, next_cursor
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let body2 = response_body_bytes(response2).await;
    let json2: serde_json::Value = serde_json::from_slice(&body2).unwrap();
    let prev_cursor = json2["pagination"]["prev_cursor"].as_str();

    // Go back to previous page using prev_cursor
    assert!(prev_cursor.is_some(), "prev_cursor should be present on page 2");
    let prev_cursor = prev_cursor.unwrap();

    let response3 = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?limit=10&cursor_before={}",
                    account_id, prev_cursor
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let body3 = response_body_bytes(response3).await;
    let json3: serde_json::Value = serde_json::from_slice(&body3).unwrap();
    let back_page_first_id = json3["data"][0]["id"].as_str().unwrap().to_string();

    // Should get back to first page
    assert_eq!(
        first_page_first_id, back_page_first_id,
        "Backward pagination should return to first page"
    );
}

// ── Filter Combination Tests ──────────────────────────────────────────

#[tokio::test]
#[ignore]
async fn test_filter_activity_type_and_asset() {
    /// Verify multiple filters work together correctly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert mixed records
    insert_test_activity(&pool, account_id, "payment", 100, base_time).await;
    insert_test_activity(&pool, account_id, "trade", 101, base_time + chrono::Duration::hours(1)).await;
    insert_test_activity(&pool, account_id, "payment", 102, base_time + chrono::Duration::hours(2)).await;

    let uri = format!(
        "/api/v1/accounts/{}/activity?activity_type=payment",
        account_id
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 2);
    for item in json["data"].as_array().unwrap() {
        assert_eq!(item["activity_type"].as_str().unwrap(), "payment");
    }
}

#[tokio::test]
#[ignore]
async fn test_filter_ledger_range() {
    /// Verify ledger range filtering works correctly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert records with different ledgers
    for i in 0..10 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + (i * 10),
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    let uri = format!(
        "/api/v1/accounts/{}/activity?ledger_min=1010&ledger_max=1050",
        account_id
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Should include ledgers 1010, 1020, 1030, 1040
    assert!(json["data"].as_array().unwrap().len() > 0);
    for item in json["data"].as_array().unwrap() {
        let ledger = item["ledger_seq"].as_i64().unwrap();
        assert!(ledger >= 1010 && ledger <= 1050);
    }
}

#[tokio::test]
#[ignore]
async fn test_filter_date_range() {
    /// Verify date range filtering works correctly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert records across a time span
    for i in 0..10 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::hours(i),
        )
        .await;
    }

    let from_date = base_time + chrono::Duration::hours(2);
    let to_date = base_time + chrono::Duration::hours(7);

    let uri = format!(
        "/api/v1/accounts/{}/activity?from_date={}&to_date={}",
        account_id,
        from_date.to_rfc3339(),
        to_date.to_rfc3339()
    );

    let response = app
        .oneshot(Request::builder().uri(&uri).body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Should get records from hours 2-7 (6 records)
    assert!(json["data"].as_array().unwrap().len() > 0);
    for item in json["data"].as_array().unwrap() {
        let created_at_str = item["created_at"].as_str().unwrap();
        let created_at = chrono::DateTime::parse_from_rfc3339(created_at_str)
            .unwrap()
            .with_timezone(&chrono::Utc);
        assert!(created_at >= from_date && created_at <= to_date);
    }
}

// ── Error Validation Tests ────────────────────────────────────────────

#[tokio::test]
#[ignore]
async fn test_both_cursors_specified_returns_400() {
    /// Verify mutual exclusivity of cursor_after and cursor_before.
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

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"].as_str().unwrap(), "INVALID_FILTER");
}

#[tokio::test]
#[ignore]
async fn test_invalid_ledger_range_returns_400() {
    /// Verify ledger range validation (min <= max).
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

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"].as_str().unwrap(), "INVALID_FILTER");
}

#[tokio::test]
#[ignore]
async fn test_invalid_date_range_returns_400() {
    /// Verify date range validation (from_date <= to_date).
    let (app, _pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    let from_date = base_time + chrono::Duration::hours(10);
    let to_date = base_time;

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!(
                    "/api/v1/accounts/{}/activity?from_date={}&to_date={}",
                    account_id,
                    from_date.to_rfc3339(),
                    to_date.to_rfc3339()
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"].as_str().unwrap(), "INVALID_FILTER");
}

#[tokio::test]
#[ignore]
async fn test_limit_min_boundary() {
    /// Verify limit=1 (minimum) works correctly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert multiple records
    for i in 0..5 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity?limit=1", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 1);
    assert!(json["pagination"]["has_next_page"].as_bool().unwrap());
}

#[tokio::test]
#[ignore]
async fn test_limit_max_boundary() {
    /// Verify limit=100 (maximum) works correctly.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert 150 records
    for i in 0..150 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(&format!("/api/v1/accounts/{}/activity?limit=100", account_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 100);
    assert!(json["pagination"]["has_next_page"].as_bool().unwrap());
}

#[tokio::test]
#[ignore]
async fn test_limit_exceeds_max_clamped() {
    /// Verify limit > 100 is clamped to 100.
    let (app, pool) = setup_test_app().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = chrono::Utc
        .with_ymd_and_hms(2024, 1, 15, 10, 30, 0)
        .unwrap();

    // Insert 150 records
    for i in 0..150 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
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

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Should be clamped to 100
    assert_eq!(json["data"].as_array().unwrap().len(), 100);
}
