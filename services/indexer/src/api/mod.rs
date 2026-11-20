pub mod account_activity;
pub mod contract_events;
pub mod health;
pub mod metrics;
pub mod statements;
pub mod validation;

use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};

use crate::error::ErrorEnvelope;

/// Fallback for paths that match no registered route.
///
/// Axum's default 404 is plain text (`404 Not Found`). Indexer clients
/// require the same JSON [`ErrorEnvelope`] as every other API error.
pub async fn not_found() -> Response {
    let mut response = (StatusCode::NOT_FOUND, Json(ErrorEnvelope::not_found())).into_response();
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    response
}
