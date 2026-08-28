use axum::{
    body::{Body, Bytes},
    http::{Request, StatusCode},
    Router,
};
use chrono::{TimeZone, Utc};
use http_body_util::BodyExt;
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use ancore_indexer::api::contract_events;
use ancore_indexer::repositories::contract_events::MAX_LIMIT;

async fn response_body_bytes(response: axum::response::Response) -> Bytes {
    response.into_body().collect().await.unwrap().to_bytes()
}

fn sample_contract_address() -> String {
    format!("C{}", "A".repeat(55))
}

fn sample_account_id() -> String {
    format!("G{}", "A".repeat(55))
}

async fn setup_test_app() -> (Router, PgPool) {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://postgres:postgres@localhost:5432/ancore_test".to_string()
    });

    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to test database");

    sqlx::query("TRUNCATE TABLE contract_events CASCADE")
        .execute(&pool)
        .await
        .expect("Failed to truncate table");

    let app = Router::new()
        .route(
            "/api/v1/contract-events",
            axum::routing::get(contract_events::list_handler),
        )
        .route(
            "/api/v1/contract-events/:event_id",
            axum::routing::get(contract_events::get_by_id_handler),
        )
        .route(
            "/api/v1/contract-events/types",
            axum::routing::get(contract_events::list_types_handler),
        )
        .with_state(pool.clone());

    (app, pool)
}

async fn insert_test_event(
    pool: &PgPool,
    contract_address: &str,
    account_id: &str,
    event_type: &str,
    ledger_seq: i64,
    timestamp: chrono::DateTime<chrono::Utc>,
) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO contract_events \
         (id, contract_address, account_id, event_type, ledger_seq, timestamp, tx_hash, data) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    )
    .bind(id)
    .bind(contract_address)
    .bind(account_id)
    .bind(event_type)
    .bind(ledger_seq)
    .bind(timestamp)
    .bind(format!("tx-{ledger_seq}-{event_type}"))
    .bind(serde_json::json!({}))
    .execute(pool)
    .await
    .expect("Failed to insert test event");

    id
}

#[tokio::test]
#[ignore]
async fn integration_test_malformed_contract_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?contract=not-a-contract")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"], "INVALID_FILTER");
    assert!(json["message"]
        .as_str()
        .unwrap()
        .contains("Stellar contract address"));
}

#[tokio::test]
#[ignore]
async fn integration_test_empty_contract_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?contract=")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"], "INVALID_FILTER");
}

#[tokio::test]
#[ignore]
async fn integration_test_offset_rejected() {
    let (app, _pool) = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?offset=999999")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"], "INVALID_FILTER");
    assert!(json["message"].as_str().unwrap().contains("cursor_after"));
}

#[tokio::test]
#[ignore]
async fn integration_test_oversized_limit_clamped() {
    let (app, pool) = setup_test_app().await;

    let contract = sample_contract_address();
    let account = sample_account_id();
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    for i in 0..(MAX_LIMIT + 20) {
        insert_test_event(
            &pool,
            &contract,
            &account,
            "executed",
            1000 + i as i64,
            base_time + chrono::Duration::seconds(i as i64),
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/contract-events?contract={}&limit=500",
                    contract
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["data"].as_array().unwrap().len() <= MAX_LIMIT as usize);
    assert!(json["pagination"]["count"].as_u64().unwrap() <= MAX_LIMIT as u64);
}

#[tokio::test]
#[ignore]
async fn integration_test_types_malformed_contract_returns_400() {
    let (app, _pool) = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events/types?contract=GABC")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["code"], "INVALID_FILTER");
}

#[tokio::test]
#[ignore]
async fn integration_test_invalid_ledger_range() {
    let (app, _pool) = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?ledger_min=200&ledger_max=100")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "INVALID_FILTER");
}

#[tokio::test]
#[ignore]
async fn integration_test_cursor_after_and_before_mutual_exclusion() {
    let (app, _pool) = setup_test_app().await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?cursor_after=abc&cursor_before=def")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
#[ignore]
async fn integration_test_list_events_happy_path() {
    let (app, pool) = setup_test_app().await;

    let contract = sample_contract_address();
    let account = sample_account_id();
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    for i in 0..5 {
        insert_test_event(
            &pool,
            &contract,
            &account,
            "session_key_added",
            1000 + i,
            base_time,
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert!(json["data"].is_array());
    assert_eq!(json["data"].as_array().unwrap().len(), 5);
    assert!(json["pagination"].is_object());
}

#[tokio::test]
#[ignore]
async fn integration_test_cursor_pagination() {
    let (app, pool) = setup_test_app().await;

    let contract = sample_contract_address();
    let account = sample_account_id();
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    for i in 0..5 {
        insert_test_event(
            &pool,
            &contract,
            &account,
            "session_key_added",
            100 + i,
            base_time + chrono::Duration::seconds(i),
        )
        .await;
    }

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?limit=2")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 2);
    assert_eq!(json["pagination"]["has_next_page"], true);
    let next_cursor = json["pagination"]["next_cursor"]
        .as_str()
        .unwrap()
        .to_string();

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/contract-events?limit=2&cursor_after={}",
                    next_cursor
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
#[ignore]
async fn integration_test_list_events_by_account() {
    let (app, pool) = setup_test_app().await;

    let contract = "CAAAA...XYZ";
    let account_a = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let account_b = "GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB";
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    insert_test_event(
        &pool,
        contract,
        account_a,
        "session_key_added",
        100,
        base_time,
    )
    .await;
    insert_test_event(
        &pool,
        contract,
        account_a,
        "session_key_added",
        101,
        base_time,
    )
    .await;
    insert_test_event(
        &pool,
        contract,
        account_b,
        "session_key_added",
        102,
        base_time,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/contract-events?account={}", account_a))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 2);
}

#[tokio::test]
#[ignore]
async fn integration_test_list_events_by_type() {
    let (app, pool) = setup_test_app().await;

    let contract = "CAAAA...XYZ";
    let account = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_added",
        100,
        base_time,
    )
    .await;
    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_revoked",
        101,
        base_time,
    )
    .await;
    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_added",
        102,
        base_time,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/contract-events?type=session_key_added")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"].as_array().unwrap().len(), 2);
    for event in json["data"].as_array().unwrap() {
        assert_eq!(event["event_type"], "session_key_added");
    }
}

#[tokio::test]
#[ignore]
async fn integration_test_get_event_by_id() {
    let (app, pool) = setup_test_app().await;

    let contract = "CAAAA...XYZ";
    let account = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    let event_id = insert_test_event(
        &pool,
        contract,
        account,
        "session_key_added",
        100,
        base_time,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/contract-events/{}", event_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(json["data"]["id"], event_id.to_string());
    assert_eq!(json["data"]["event_type"], "session_key_added");
}

#[tokio::test]
#[ignore]
async fn integration_test_get_event_by_id_not_found() {
    let (app, _pool) = setup_test_app().await;

    let fake_id = Uuid::new_v4();
    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/contract-events/{}", fake_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
#[ignore]
async fn integration_test_list_types() {
    let (app, pool) = setup_test_app().await;

    let contract = "CAAAA...XYZ";
    let account = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_added",
        100,
        base_time,
    )
    .await;
    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_revoked",
        101,
        base_time,
    )
    .await;
    insert_test_event(&pool, contract, account, "initialized", 102, base_time).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/contract-events/types?contract={}",
                    contract
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    let types = json["data"].as_array().unwrap();
    assert_eq!(types.len(), 3);
    assert!(types.contains(&serde_json::Value::String("initialized".to_string())));
    assert!(types.contains(&serde_json::Value::String("session_key_added".to_string())));
    assert!(types.contains(&serde_json::Value::String(
        "session_key_revoked".to_string()
    )));
}

#[tokio::test]
#[ignore]
async fn integration_test_list_types_by_account() {
    let (app, pool) = setup_test_app().await;

    let contract = "CAAAA...XYZ";
    let account = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_added",
        100,
        base_time,
    )
    .await;
    insert_test_event(
        &pool,
        contract,
        account,
        "session_key_ttl_refreshed",
        101,
        base_time,
    )
    .await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/contract-events/types?account={}", account))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    let types = json["data"].as_array().unwrap();
    assert_eq!(types.len(), 2);
    assert!(types.contains(&serde_json::Value::String("session_key_added".to_string())));
    assert!(types.contains(&serde_json::Value::String(
        "session_key_ttl_refreshed".to_string()
    )));
}

#[tokio::test]
#[ignore]
async fn integration_test_all_event_types_stored() {
    let (app, pool) = setup_test_app().await;

    let contract = "CAAAA...XYZ";
    let account = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 6, 1, 12, 0, 0).unwrap();

    let event_types = vec![
        "initialized",
        "executed",
        "session_key_added",
        "session_key_revoked",
        "session_key_ttl_refreshed",
        "upgraded",
        "migrated",
    ];

    for (i, et) in event_types.iter().enumerate() {
        insert_test_event(
            &pool,
            contract,
            account,
            et,
            100 + i as i64,
            base_time + chrono::Duration::seconds(i as i64),
        )
        .await;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/v1/contract-events/types?contract={}",
                    contract
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response_body_bytes(response).await;
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

    let types = json["data"].as_array().unwrap();
    assert_eq!(types.len(), 7);
}
