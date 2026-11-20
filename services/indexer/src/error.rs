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

impl ErrorEnvelope {
    /// Canonical 404 body for missing resources and unmatched routes.
    pub fn not_found() -> Self {
        Self {
            code: codes::NOT_FOUND,
            message: "Resource not found".to_string(),
            details: None,
        }
    }
}

/// Canonical error codes used across all indexer API routes.
pub mod codes {
    pub const INVALID_CURSOR: &str = "INVALID_CURSOR";
    pub const INVALID_FILTER: &str = "INVALID_FILTER";
    pub const NOT_FOUND: &str = "NOT_FOUND";
    pub const QUERY_TIMEOUT: &str = "QUERY_TIMEOUT";
    pub const DATABASE_ERROR: &str = "DATABASE_ERROR";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
    pub const SERVICE_UNAVAILABLE: &str = "SERVICE_UNAVAILABLE";
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

    #[error("Service unavailable: {0}")]
    ServiceUnavailable(String),
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
                ApiError::ServiceUnavailable(msg) => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    codes::SERVICE_UNAVAILABLE,
                    msg,
                    None,
                ),
                ApiError::NotFound => {
                    let envelope = ErrorEnvelope::not_found();
                    (
                        StatusCode::NOT_FOUND,
                        envelope.code,
                        envelope.message,
                        envelope.details,
                    )
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

        let envelope = ErrorEnvelope {
            code,
            message,
            details,
        };
        (status, Json(envelope)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, ApiError>;

#[cfg(test)]
mod tests {
    use super::*;
    use http_body_util::BodyExt;

    async fn respond(err: ApiError) -> (StatusCode, serde_json::Value) {
        let response = err.into_response();
        let status = response.status();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice(&bytes).unwrap())
    }

    #[tokio::test]
    async fn not_found_maps_to_404() {
        let (status, body) = respond(ApiError::NotFound).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["code"], codes::NOT_FOUND);
        assert_eq!(body["message"], "Resource not found");
    }

    #[tokio::test]
    async fn invalid_cursor_maps_to_400() {
        let (status, body) = respond(ApiError::InvalidCursor("bad".into())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["code"], codes::INVALID_CURSOR);
        assert_eq!(body["message"], "bad");
    }

    #[tokio::test]
    async fn invalid_filter_maps_to_400() {
        let (status, body) = respond(ApiError::InvalidFilter("bad".into())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["code"], codes::INVALID_FILTER);
    }

    #[tokio::test]
    async fn service_unavailable_maps_to_503() {
        let (status, body) = respond(ApiError::ServiceUnavailable("down".into())).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(body["code"], codes::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn pool_timeout_maps_to_504() {
        let (status, body) = respond(ApiError::Database(sqlx::Error::PoolTimedOut)).await;
        assert_eq!(status, StatusCode::GATEWAY_TIMEOUT);
        assert_eq!(body["code"], codes::QUERY_TIMEOUT);
    }

    #[tokio::test]
    async fn database_error_is_sanitized_500() {
        let raw = sqlx::Error::Protocol("relation \"secret_table\" does not exist".into());
        let (status, body) = respond(ApiError::Database(raw)).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body["code"], codes::DATABASE_ERROR);
        assert_eq!(body["message"], "Database error");
        assert!(!body.to_string().contains("secret_table"));
    }

    #[tokio::test]
    async fn internal_error_is_sanitized_500() {
        let (status, body) = respond(ApiError::Internal(anyhow::anyhow!("password=hunter2"))).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body["code"], codes::INTERNAL_ERROR);
        assert_eq!(body["message"], "Internal server error");
        assert!(!body.to_string().contains("hunter2"));
    }

    #[tokio::test]
    async fn details_are_omitted_when_none() {
        let (_, body) = respond(ApiError::NotFound).await;
        assert!(body.get("details").is_none());
    }
}
