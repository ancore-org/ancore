use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::Value;
use thiserror::Error;

/// Structured error envelope returned by all API routes.
///
/// Shape: `{ "code": "...", "message": "...", "details"?: ... }`
///
/// Issue #581
#[derive(Debug, Serialize)]
pub struct ErrorEnvelope {
    /// Machine-readable error code (e.g. `"INVALID_CURSOR"`, `"NOT_FOUND"`).
    pub code: &'static str,
    /// Human-readable description of the error.
    pub message: String,
    /// Optional structured details (validation context, field names, etc.).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

/// Canonical error codes used across all indexer API routes.
pub mod codes {
    pub const INVALID_CURSOR: &str = "INVALID_CURSOR";
    pub const INVALID_FILTER: &str = "INVALID_FILTER";
    pub const NOT_FOUND: &str = "NOT_FOUND";
    pub const QUERY_TIMEOUT: &str = "QUERY_TIMEOUT";
    pub const DATABASE_ERROR: &str = "DATABASE_ERROR";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
}

#[derive(Error, Debug)]
pub enum ApiError {
    #[error("Invalid cursor: {0}")]
    InvalidCursor(String),

    #[error("Invalid filter: {0}")]
    InvalidFilter(String),

    #[error("Not found")]
    NotFound,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Query timed out: {0}")]
    QueryTimeout(String),

    #[error("Internal server error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code, message, details): (StatusCode, &'static str, String, Option<Value>) =
            match self {
                ApiError::InvalidCursor(msg) => {
                    (StatusCode::BAD_REQUEST, codes::INVALID_CURSOR, msg, None)
                }
                ApiError::InvalidFilter(msg) => {
                    (StatusCode::BAD_REQUEST, codes::INVALID_FILTER, msg, None)
                }
                ApiError::NotFound => (
                    StatusCode::NOT_FOUND,
                    codes::NOT_FOUND,
                    "Resource not found".to_string(),
                    None,
                ),
                ApiError::QueryTimeout(msg) => {
                    (StatusCode::GATEWAY_TIMEOUT, codes::QUERY_TIMEOUT, msg, None)
                }
                ApiError::Database(err) => {
                    if matches!(err, sqlx::Error::PoolTimedOut) {
                        (
                            StatusCode::GATEWAY_TIMEOUT,
                            codes::QUERY_TIMEOUT,
                            "Database pool timed out".to_string(),
                            None,
                        )
                    } else if err
                        .as_database_error()
                        .and_then(|db_err| db_err.code())
                        .map(|c| c == "57014")
                        .unwrap_or(false)
                    {
                        (
                            StatusCode::GATEWAY_TIMEOUT,
                            codes::QUERY_TIMEOUT,
                            "Database query timed out".to_string(),
                            None,
                        )
                    } else {
                        tracing::error!("Database error: {:?}", err);
                        (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            codes::DATABASE_ERROR,
                            "Database error".to_string(),
                            None,
                        )
                    }
                }
                ApiError::Internal(err) => {
                    tracing::error!("Internal error: {:?}", err);
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        codes::INTERNAL_ERROR,
                        "Internal server error".to_string(),
                        None,
                    )
                }
            };

        let envelope = ErrorEnvelope { code, message, details };
        (status, Json(envelope)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, ApiError>;
