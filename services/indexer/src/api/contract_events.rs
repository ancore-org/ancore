use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::Result;
use crate::schema::contract_event::{
    ContractEvent, ContractEventFilter,
};

/// Query parameters for contract events list endpoint.
#[derive(Debug, Deserialize)]
pub struct ListContractEventsQuery {
    contract: Option<String>,
    #[serde(rename = "type")]
    event_type: Option<String>,
    ledger_min: Option<i64>,
    ledger_max: Option<i64>,
    limit: Option<u32>,
    offset: Option<u64>,
}

/// Response envelope for contract events list.
#[derive(Debug, Serialize)]
pub struct ContractEventsListResponse {
    pub data: Vec<ContractEvent>,
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

/// List contract events with optional filters.
pub async fn list_handler(
    State(db): State<PgPool>,
    Query(params): Query<ListContractEventsQuery>,
) -> Result<Json<ContractEventsListResponse>> {
    // Validate ledger range
    if let (Some(min), Some(max)) = (params.ledger_min, params.ledger_max) {
        if min > max {
            return Err(crate::error::ApiError::InvalidFilter(
                "ledger_min must be <= ledger_max".to_string(),
            ));
        }
    }

    let filter = ContractEventFilter {
        contract_address: params.contract,
        event_type: params.event_type,
        ledger_min: params.ledger_min,
        ledger_max: params.ledger_max,
        limit: params.limit,
        offset: params.offset,
    };

    let events =
        crate::repositories::contract_events::get_contract_events(&db, &filter).await?;

    let count = events.len();
    Ok(Json(ContractEventsListResponse { data: events, count }))
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
        crate::repositories::contract_events::get_contract_event_by_id(&db, &event_uuid)
            .await?;

    match event {
        Some(record) => Ok(Json(ContractEventResponse { data: record })),
        None => Err(crate::error::ApiError::NotFound),
    }
}

/// Get distinct event types for a contract address.
pub async fn list_types_handler(
    State(db): State<PgPool>,
    Query(params): Query<ListContractEventsQuery>,
) -> Result<Json<ContractEventTypesResponse>> {
    let contract_address = params.contract.ok_or_else(|| {
        crate::error::ApiError::InvalidFilter(
            "contract query parameter is required".to_string(),
        )
    })?;

    let types =
        crate::repositories::contract_events::get_contract_event_types(&db, &contract_address)
            .await?;

    Ok(Json(ContractEventTypesResponse { data: types }))
}
