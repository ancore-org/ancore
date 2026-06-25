use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::error::{ApiError, Result};
use crate::repositories::account_activity::{ActivityFilter, CursorPage};

#[derive(Debug, Deserialize)]
pub struct StatementRowsQuery {
    cursor_after: Option<String>,
    limit: Option<u32>,
    from_date: String,
    to_date: String,
}

#[derive(Debug, Serialize)]
pub struct StatementRow {
    id: String,
    timestamp: DateTime<Utc>,
    counterparty: String,
    amount: String,
    asset: String,
    status: String,
    memo_or_reference: String,
}

#[derive(Debug, Serialize)]
pub struct StatementRowsResponse {
    rows: Vec<StatementRow>,
    next_cursor: Option<String>,
}

fn validate_account_id(id: &str) -> Result<()> {
    if id.is_empty() {
        return Err(ApiError::InvalidFilter(
            "account_id cannot be empty".to_string(),
        ));
    }
    if id.len() != 56 || !id.starts_with('G') {
        return Err(ApiError::InvalidFilter(
            "account_id must be a valid Stellar public key (56 characters starting with G)"
                .to_string(),
        ));
    }
    Ok(())
}

fn parse_iso_datetime(s: &str) -> Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| {
            ApiError::InvalidFilter(format!(
                "Invalid datetime format: {}, expected ISO 8601 (RFC3339)",
                s
            ))
        })
}

fn metadata_string(metadata: Option<&serde_json::Value>, key: &str) -> Option<String> {
    metadata
        .and_then(|value| value.get(key))
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
}

pub async fn rows_handler(
    State(db): State<PgPool>,
    Path(account_id): Path<String>,
    Query(params): Query<StatementRowsQuery>,
) -> Result<Json<StatementRowsResponse>> {
    validate_account_id(&account_id)?;

    let from_date = parse_iso_datetime(&params.from_date)?;
    let to_date = parse_iso_datetime(&params.to_date)?;
    if from_date > to_date {
        return Err(ApiError::InvalidFilter(
            "from_date must be <= to_date".to_string(),
        ));
    }

    let filter = ActivityFilter {
        from_date: Some(from_date),
        to_date: Some(to_date),
        ..Default::default()
    };
    let page = CursorPage {
        after: params.cursor_after,
        before: None,
        limit: params.limit,
    };

    let result = crate::repositories::account_activity::get_account_activity(
        &db,
        &account_id,
        &filter,
        &page,
    )
    .await?;

    let rows = result
        .items
        .into_iter()
        .map(|activity| {
            let status = metadata_string(activity.metadata.as_ref(), "status")
                .unwrap_or_else(|| "unknown".to_string());
            let memo_or_reference = metadata_string(activity.metadata.as_ref(), "memoOrReference")
                .or_else(|| metadata_string(activity.metadata.as_ref(), "memo"))
                .or_else(|| metadata_string(activity.metadata.as_ref(), "reference"))
                .unwrap_or_else(|| activity.tx_hash.clone());

            StatementRow {
                id: activity.id.to_string(),
                timestamp: activity.created_at,
                counterparty: activity.counterparty.unwrap_or_else(|| "—".to_string()),
                amount: activity.amount.unwrap_or_else(|| "0".to_string()),
                asset: activity.asset.unwrap_or_else(|| "XLM".to_string()),
                status,
                memo_or_reference,
            }
        })
        .collect();

    Ok(Json(StatementRowsResponse {
        rows,
        next_cursor: result.next_cursor,
    }))
}
