use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::Result;
use crate::repositories::account_activity::{
    ActivityFilter, ActivityRecord, CursorPage, PageResult,
};

/// Query parameters for activity list endpoint
#[derive(Debug, Deserialize)]
pub struct ListActivityQuery {
    cursor_after: Option<String>,
    cursor_before: Option<String>,
    limit: Option<u32>,
    activity_type: Option<String>,
    asset: Option<String>,
    counterparty: Option<String>,
    ledger_min: Option<i64>,
    ledger_max: Option<i64>,
    from_date: Option<String>,
    to_date: Option<String>,
}

/// Response envelope for activity list
#[derive(Debug, Serialize)]
pub struct ActivityListResponse {
    data: Vec<ActivityRecord>,
    pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    has_next_page: bool,
    has_previous_page: bool,
    next_cursor: Option<String>,
    prev_cursor: Option<String>,
    count: usize,
}

/// Response envelope for single activity
#[derive(Debug, Serialize)]
pub struct ActivityResponse {
    data: ActivityRecord,
}

/// Response envelope for activity types
#[derive(Debug, Serialize)]
pub struct ActivityTypesResponse {
    data: Vec<String>,
}

/// Validate Stellar account ID format (basic validation)
fn validate_account_id(id: &str) -> Result<()> {
    if id.is_empty() {
        return Err(crate::error::ApiError::InvalidFilter(
            "account_id cannot be empty".to_string(),
        ));
    }
    // Stellar public keys are typically 56 characters (G + 56 base32 chars)
    if id.len() != 56 || !id.starts_with('G') {
        return Err(crate::error::ApiError::InvalidFilter(
            "account_id must be a valid Stellar public key (56 characters starting with G)".to_string(),
        ));
    }
    Ok(())
}

/// Parse ISO datetime string
fn parse_iso_datetime(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| {
            crate::error::ApiError::InvalidFilter(format!(
                "Invalid datetime format: {}, expected ISO 8601 (RFC3339)",
                s
            ))
        })
}

/// List account activity with pagination and filters
pub async fn list_handler(
    State(db): State<PgPool>,
    Path(account_id): Path<String>,
    Query(params): Query<ListActivityQuery>,
) -> Result<Json<ActivityListResponse>> {
    // Validate account_id
    validate_account_id(&account_id)?;

    // Validate cursor mutual exclusivity
    if params.cursor_after.is_some() && params.cursor_before.is_some() {
        return Err(crate::error::ApiError::InvalidFilter(
            "cannot specify both cursor_after and cursor_before".to_string(),
        ));
    }

    // Validate ledger range
    if let (Some(min), Some(max)) = (params.ledger_min, params.ledger_max) {
        if min > max {
            return Err(crate::error::ApiError::InvalidFilter(
                "ledger_min must be <= ledger_max".to_string(),
            ));
        }
    }

    // Parse date filters
    let from_date = if let Some(ref date_str) = params.from_date {
        Some(parse_iso_datetime(date_str)?)
    } else {
        None
    };

    let to_date = if let Some(ref date_str) = params.to_date {
        Some(parse_iso_datetime(date_str)?)
    } else {
        None
    };

    // Build filter
    let filter = ActivityFilter {
        activity_type: params.activity_type,
        asset: params.asset,
        counterparty: params.counterparty,
        ledger_min: params.ledger_min,
        ledger_max: params.ledger_max,
        from_date,
        to_date,
    };

    // Build cursor page
    let page = CursorPage {
        after: params.cursor_after,
        before: params.cursor_before,
        limit: params.limit,
    };

    // Query repository
    let result = crate::repositories::account_activity::get_account_activity(&db, &account_id, &filter, &page).await?;

    let response = ActivityListResponse {
        data: result.items,
        pagination: PaginationInfo {
            has_next_page: result.has_next_page,
            has_previous_page: result.has_previous_page,
            next_cursor: result.next_cursor,
            prev_cursor: result.prev_cursor,
            count: result.items.len(),
        },
    };

    Ok(Json(response))
}

/// Get a single activity by ID
pub async fn get_by_id_handler(
    State(db): State<PgPool>,
    Path((account_id, activity_id)): Path<(String, String)>,
) -> Result<Json<ActivityResponse>> {
    // Validate account_id
    validate_account_id(&account_id)?;

    // Parse activity_id
    let activity_uuid = Uuid::parse_str(&activity_id).map_err(|_| {
        crate::error::ApiError::InvalidFilter("activity_id must be a valid UUID".to_string())
    })?;

    // Query repository
    let activity = crate::repositories::account_activity::get_activity_by_id(&db, &account_id, &activity_uuid).await?;

    match activity {
        Some(record) => Ok(Json(ActivityResponse { data: record })),
        None => Err(crate::error::ApiError::NotFound),
    }
}

/// Get distinct activity types for an account
pub async fn list_types_handler(
    State(db): State<PgPool>,
    Path(account_id): Path<String>,
) -> Result<Json<ActivityTypesResponse>> {
    // Validate account_id
    validate_account_id(&account_id)?;

    // Query repository
    let types = crate::repositories::account_activity::get_activity_types(&db, &account_id).await?;

    Ok(Json(ActivityTypesResponse { data: types }))
}
