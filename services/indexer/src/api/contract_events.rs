use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::api::validation::validate_account_id;
use crate::error::Result;
use crate::repositories::contract_events::{MAX_LIMIT, MIN_LIMIT};
use crate::schema::contract_event::{ContractEvent, ContractEventFilter};

/// Query parameters for contract events list endpoint.
#[derive(Debug, Deserialize)]
pub struct ListContractEventsQuery {
    contract: Option<String>,
    account: Option<String>,
    #[serde(rename = "type")]
    event_type: Option<String>,
    ledger_min: Option<i64>,
    ledger_max: Option<i64>,
    limit: Option<u32>,
    /// Deprecated: offset pagination is rejected. Use `cursor_after` / `cursor_before`.
    offset: Option<u64>,
    cursor_after: Option<String>,
    cursor_before: Option<String>,
}

/// Response envelope for contract events list.
#[derive(Debug, Serialize)]
pub struct ContractEventsListResponse {
    pub data: Vec<ContractEvent>,
    pub pagination: ContractEventsPagination,
}

/// Pagination metadata for contract events.
#[derive(Debug, Serialize)]
pub struct ContractEventsPagination {
    pub has_next_page: bool,
    pub has_previous_page: bool,
    pub next_cursor: Option<String>,
    pub prev_cursor: Option<String>,
    pub count: usize,
}

/// Response envelope for single contract event.
#[derive(Debug, Serialize)]
pub struct ContractEventResponse {
    data: ContractEvent,
}

/// Response envelope for contract event types.
#[derive(Debug, Serialize)]
pub struct ContractEventTypesResponse {
    data: Vec<String>,
}

/// Validate Stellar contract address format (C-address strkey).
fn validate_contract_address(id: &str) -> Result<()> {
    if id.is_empty() {
        return Err(crate::error::ApiError::InvalidFilter(
            "contract cannot be empty".to_string(),
        ));
    }
    if id.len() != 56 || !id.starts_with('C') {
        return Err(crate::error::ApiError::InvalidFilter(
            "contract must be a valid Stellar contract address (56 characters starting with C)"
                .to_string(),
        ));
    }
    Ok(())
}

fn clamp_limit(limit: Option<u32>) -> Option<u32> {
    limit.map(|l| l.clamp(MIN_LIMIT, MAX_LIMIT))
}

/// List contract events with optional filters and cursor pagination.
pub async fn list_handler(
    State(db): State<PgPool>,
    Query(params): Query<ListContractEventsQuery>,
) -> Result<Json<ContractEventsListResponse>> {
    if let Some(ref contract) = params.contract {
        validate_contract_address(contract)?;
    }
    if let Some(ref account) = params.account {
        validate_account_id(account)?;
    }

    if params.offset.is_some() {
        return Err(crate::error::ApiError::InvalidFilter(
            "offset is not supported; use cursor_after or cursor_before".to_string(),
        ));
    }

    if params.cursor_after.is_some() && params.cursor_before.is_some() {
        return Err(crate::error::ApiError::InvalidFilter(
            "cannot specify both cursor_after and cursor_before".to_string(),
        ));
    }

    if let (Some(min), Some(max)) = (params.ledger_min, params.ledger_max) {
        if min > max {
            return Err(crate::error::ApiError::InvalidFilter(
                "ledger_min must be <= ledger_max".to_string(),
            ));
        }
    }

    let filter = ContractEventFilter {
        contract_address: params.contract,
        account_id: params.account,
        event_type: params.event_type,
        ledger_min: params.ledger_min,
        ledger_max: params.ledger_max,
        limit: clamp_limit(params.limit),
        offset: None,
        cursor_after: params.cursor_after,
        cursor_before: params.cursor_before,
    };

    let result = crate::repositories::contract_events::get_contract_events(&db, &filter).await?;

    let count = result.items.len();
    Ok(Json(ContractEventsListResponse {
        data: result.items,
        pagination: ContractEventsPagination {
            has_next_page: result.has_next_page,
            has_previous_page: result.has_previous_page,
            next_cursor: result.next_cursor,
            prev_cursor: result.prev_cursor,
            count,
        },
    }))
}

/// Get a single contract event by ID.
pub async fn get_by_id_handler(
    State(db): State<PgPool>,
    Path(event_id): Path<String>,
) -> Result<Json<ContractEventResponse>> {
    let event_uuid = Uuid::parse_str(&event_id).map_err(|_| {
        crate::error::ApiError::InvalidFilter("event_id must be a valid UUID".to_string())
    })?;

    let event =
        crate::repositories::contract_events::get_contract_event_by_id(&db, &event_uuid).await?;

    match event {
        Some(record) => Ok(Json(ContractEventResponse { data: record })),
        None => Err(crate::error::ApiError::NotFound),
    }
}

/// Get distinct event types for a contract address or account.
pub async fn list_types_handler(
    State(db): State<PgPool>,
    Query(params): Query<ListContractEventsQuery>,
) -> Result<Json<ContractEventTypesResponse>> {
    if let Some(ref contract) = params.contract {
        validate_contract_address(contract)?;
    }
    if let Some(ref account) = params.account {
        validate_account_id(account)?;
    }

    let types = crate::repositories::contract_events::get_contract_event_types(
        &db,
        params.contract.as_deref(),
        params.account.as_deref(),
    )
    .await?;

    Ok(Json(ContractEventTypesResponse { data: types }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ApiError;

    #[test]
    fn validate_contract_address_accepts_c_strkey() {
        let addr = format!("C{}", "A".repeat(55));
        assert_eq!(addr.len(), 56);
        assert!(validate_contract_address(&addr).is_ok());
    }

    #[test]
    fn validate_contract_address_rejects_empty() {
        assert!(matches!(
            validate_contract_address("").unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn validate_contract_address_rejects_g_account() {
        let addr = format!("G{}", "A".repeat(55));
        assert!(matches!(
            validate_contract_address(&addr).unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn validate_contract_address_rejects_wrong_length() {
        assert!(matches!(
            validate_contract_address("CSHORT").unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn validate_account_id_accepts_g_strkey() {
        let addr = "GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB";
        assert!(validate_account_id(addr).is_ok());
    }

    #[test]
    fn validate_account_id_rejects_bad_checksum() {
        let addr = format!("G{}", "A".repeat(55));
        assert!(matches!(
            validate_account_id(&addr).unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn validate_account_id_rejects_contract() {
        let addr = format!("C{}", "A".repeat(55));
        assert!(matches!(
            validate_account_id(&addr).unwrap_err(),
            ApiError::InvalidFilter(_)
        ));
    }

    #[test]
    fn clamp_limit_bounds() {
        assert_eq!(clamp_limit(Some(0)), Some(MIN_LIMIT));
        assert_eq!(clamp_limit(Some(MAX_LIMIT + 50)), Some(MAX_LIMIT));
        assert_eq!(clamp_limit(Some(25)), Some(25));
        assert_eq!(clamp_limit(None), None);
    }
}
