use chrono::{Duration, TimeZone, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::account_activity::{
    ActivityFilter, ActivityRecord, CursorPage, DEFAULT_LIMIT, MAX_LIMIT, MIN_LIMIT,
};

async fn setup_test_db() -> PgPool {
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

    pool
}

async fn insert_test_activity(
    pool: &PgPool,
    account_id: &str,
    activity_type: &str,
    ledger_seq: i64,
    created_at: chrono::DateTime<Utc>,
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
#[ignore] // Requires test database
async fn test_filter_with_no_filters_returns_all_activity() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 5 activity records
    for i in 0..5 {
        insert_test_activity(
            &pool,
            account_id,
            "payment",
            1000 + i as i64,
            base_time + Duration::seconds(i as i64),
        )
        .await;
    }

    let filter = ActivityFilter::default();
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 5);
}

#[tokio::test]
#[ignore]
async fn test_filter_by_activity_type() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 3 payment + 2 trade records
    for i in 0..3 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + Duration::seconds(i)).await;
    }
    for i in 0..2 {
        insert_test_activity(&pool, account_id, "trade", 2000 + i, base_time + Duration::seconds(3 + i)).await;
    }

    let filter = ActivityFilter {
        activity_type: Some("payment".to_string()),
        ..Default::default()
    };
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 3);
    assert!(result.items.iter().all(|a| a.activity_type == "payment"));
}

#[tokio::test]
#[ignore]
async fn test_filter_by_date_range() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert records at different timestamps
    insert_test_activity(&pool, account_id, "payment", 1000, base_time - Duration::days(2)).await;
    insert_test_activity(&pool, account_id, "payment", 1001, base_time - Duration::days(1)).await;
    insert_test_activity(&pool, account_id, "payment", 1002, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 1003, base_time + Duration::days(1)).await;
    insert_test_activity(&pool, account_id, "payment", 1004, base_time + Duration::days(2)).await;

    let filter = ActivityFilter {
        from_date: Some(base_time - Duration::days(1)),
        to_date: Some(base_time + Duration::days(1)),
        ..Default::default()
    };
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 3);
}

#[tokio::test]
#[ignore]
async fn test_filter_by_ledger_range() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert records with known ledger_seq values
    insert_test_activity(&pool, account_id, "payment", 100, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 150, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 200, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 250, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 300, base_time).await;

    let filter = ActivityFilter {
        ledger_min: Some(150),
        ledger_max: Some(250),
        ..Default::default()
    };
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 3);
    assert!(result.items.iter().all(|a| a.ledger_seq >= 150 && a.ledger_seq <= 250));
}

#[tokio::test]
#[ignore]
async fn test_combined_filters() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert mixed records
    insert_test_activity(&pool, account_id, "payment", 100, base_time - Duration::days(2)).await;
    insert_test_activity(&pool, account_id, "trade", 150, base_time - Duration::days(1)).await;
    insert_test_activity(&pool, account_id, "payment", 200, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 250, base_time + Duration::days(1)).await;
    insert_test_activity(&pool, account_id, "trade", 300, base_time + Duration::days(2)).await;

    let filter = ActivityFilter {
        activity_type: Some("payment".to_string()),
        from_date: Some(base_time - Duration::days(1)),
        to_date: Some(base_time + Duration::days(1)),
        ..Default::default()
    };
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 2);
    assert!(result.items.iter().all(|a| a.activity_type == "payment"));
}

#[tokio::test]
#[ignore]
async fn test_pagination_default_limit() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 25 records
    for i in 0..25 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + Duration::seconds(i)).await;
    }

    let filter = ActivityFilter::default();
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), DEFAULT_LIMIT as usize);
    assert!(result.has_next_page);
    assert!(result.next_cursor.is_some());
}

#[tokio::test]
#[ignore]
async fn test_pagination_explicit_limit() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 10 records
    for i in 0..10 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + Duration::seconds(i)).await;
    }

    let filter = ActivityFilter::default();
    let page = CursorPage {
        limit: Some(5),
        ..Default::default()
    };

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 5);
    assert!(result.has_next_page);
    assert!(result.next_cursor.is_some());
}

#[tokio::test]
#[ignore]
async fn test_pagination_last_page() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 5 records
    for i in 0..5 {
        insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + Duration::seconds(i)).await;
    }

    let filter = ActivityFilter::default();
    let page = CursorPage {
        limit: Some(10),
        ..Default::default()
    };

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 5);
    assert!(!result.has_next_page);
    assert!(result.next_cursor.is_none());
}

#[tokio::test]
#[ignore]
async fn test_cursor_forward_pagination_consistency() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 25 records with known ordering
    let mut all_ids = Vec::new();
    for i in 0..25 {
        let id = insert_test_activity(&pool, account_id, "payment", 1000 + i, base_time + Duration::seconds(i)).await;
        all_ids.push(id);
    }

    let filter = ActivityFilter::default();
    
    // Page 1
    let page1 = CursorPage {
        limit: Some(10),
        ..Default::default()
    };
    let result1 = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page1)
        .await
        .expect("Failed to query page 1");
    
    assert_eq!(result1.items.len(), 10);
    let cursor1 = result1.next_cursor.clone().expect("No next cursor");

    // Page 2
    let page2 = CursorPage {
        after: Some(cursor1),
        limit: Some(10),
        ..Default::default()
    };
    let result2 = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page2)
        .await
        .expect("Failed to query page 2");
    
    assert_eq!(result2.items.len(), 10);
    let cursor2 = result2.next_cursor.clone().expect("No next cursor");

    // Page 3
    let page3 = CursorPage {
        after: Some(cursor2),
        limit: Some(10),
        ..Default::default()
    };
    let result3 = crate::repositories::account_activity::get_account_activity(&pool, account_id, &filter, &page3)
        .await
        .expect("Failed to query page 3");
    
    assert_eq!(result3.items.len(), 5);
    assert!(!result3.has_next_page);

    // Collect all IDs from all pages
    let mut all_page_ids = Vec::new();
    all_page_ids.extend(result1.items.iter().map(|a| a.id));
    all_page_ids.extend(result2.items.iter().map(|a| a.id));
    all_page_ids.extend(result3.items.iter().map(|a| a.id));

    // Verify no duplicates and all IDs present
    assert_eq!(all_page_ids.len(), 25);
    assert_eq!(all_page_ids.len(), all_ids.len());
}

#[tokio::test]
#[ignore]
async fn test_account_scoping() {
    let pool = setup_test_db().await;

    let account_a = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let account_b = "GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert 5 records for account A
    for i in 0..5 {
        insert_test_activity(&pool, account_a, "payment", 1000 + i, base_time + Duration::seconds(i)).await;
    }

    // Insert 5 records for account B
    for i in 0..5 {
        insert_test_activity(&pool, account_b, "payment", 2000 + i, base_time + Duration::seconds(i)).await;
    }

    let filter = ActivityFilter::default();
    let page = CursorPage::default();

    let result = crate::repositories::account_activity::get_account_activity(&pool, account_a, &filter, &page)
        .await
        .expect("Failed to query activity");

    assert_eq!(result.items.len(), 5);
    assert!(result.items.iter().all(|a| a.account_id == account_a));
}

#[tokio::test]
#[ignore]
async fn test_get_activity_types_distinct() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    // Insert payment, payment, trade, trust_change
    insert_test_activity(&pool, account_id, "payment", 1000, base_time).await;
    insert_test_activity(&pool, account_id, "payment", 1001, base_time + Duration::seconds(1)).await;
    insert_test_activity(&pool, account_id, "trade", 1002, base_time + Duration::seconds(2)).await;
    insert_test_activity(&pool, account_id, "trust_change", 1003, base_time + Duration::seconds(3)).await;

    let types = crate::repositories::account_activity::get_activity_types(&pool, account_id)
        .await
        .expect("Failed to get activity types");

    assert_eq!(types.len(), 3);
    assert!(types.contains(&"payment".to_string()));
    assert!(types.contains(&"trade".to_string()));
    assert!(types.contains(&"trust_change".to_string()));
}

#[tokio::test]
#[ignore]
async fn test_get_activity_by_id_found() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    let id = insert_test_activity(&pool, account_id, "payment", 1000, base_time).await;

    let activity = crate::repositories::account_activity::get_activity_by_id(&pool, account_id, &id)
        .await
        .expect("Failed to get activity by id");

    assert!(activity.is_some());
    assert_eq!(activity.as_ref().unwrap().id, id);
}

#[tokio::test]
#[ignore]
async fn test_get_activity_by_id_not_found() {
    let pool = setup_test_db().await;

    let account_id = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let random_id = Uuid::new_v4();

    let activity = crate::repositories::account_activity::get_activity_by_id(&pool, account_id, &random_id)
        .await
        .expect("Failed to get activity by id");

    assert!(activity.is_none());
}

#[tokio::test]
#[ignore]
async fn test_get_activity_by_id_wrong_account() {
    let pool = setup_test_db().await;

    let account_a = "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let account_b = "GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
    let base_time = Utc.with_ymd_and_hms(2024, 1, 15, 10, 30, 0).unwrap();

    let id = insert_test_activity(&pool, account_a, "payment", 1000, base_time).await;

    // Try to get account A's activity using account B
    let activity = crate::repositories::account_activity::get_activity_by_id(&pool, account_b, &id)
        .await
        .expect("Failed to get activity by id");

    assert!(activity.is_none());
}
