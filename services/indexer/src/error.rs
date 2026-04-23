use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

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

    #[error("Internal server error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match self {
            ApiError::InvalidCursor(msg) => (StatusCode::BAD_REQUEST, "invalid_cursor", msg),
            ApiError::InvalidFilter(msg) => (StatusCode::BAD_REQUEST, "invalid_filter", msg),
            ApiError::NotFound => (StatusCode::NOT_FOUND, "not_found", "Resource not found".to_string()),
            ApiError::Database(err) => {
                tracing::error!("Database error: {:?}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "Database error".to_string())
            }
            ApiError::Internal(err) => {
                tracing::error!("Internal error: {:?}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "Internal server error".to_string())
            }
        };

        let body = json!({
            "error": error_type,
            "detail": message
        });

        (status, Json(body)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, ApiError>;
