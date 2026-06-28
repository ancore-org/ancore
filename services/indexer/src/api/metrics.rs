use axum::{extract::State, http::StatusCode, response::IntoResponse, response::Json};
use serde::Serialize;
use sqlx::PgPool;

use crate::error::Result;
use crate::metrics::{get_cursor_metrics, CursorMetrics};

/// Metrics response body.
///
/// Provides operational visibility into cursor staleness and ingestion health.
#[derive(Debug, Serialize)]
pub struct MetricsResponse {
    /// Cursor staleness metrics for all ingestion streams.
    pub cursors: Vec<CursorMetrics>,
    /// Overall health status based on cursor staleness.
    pub status: String,
}

/// GET /metrics (JSON format)
///
/// Returns cursor staleness metrics for operational monitoring and alerting.
/// Exposes whether any ingestion streams have stale cursors that may indicate
/// processing issues.
///
/// Note: This endpoint returns JSON. For Prometheus scraping, use the
/// Prometheus exporter's built-in `/metrics` endpoint which returns
/// Prometheus text format.
pub async fn metrics_handler(State(db): State<PgPool>) -> Result<Json<MetricsResponse>> {
    let cursors = get_cursor_metrics(&db).await?;

    // Determine overall status based on whether any cursor is stale
    let status = if cursors.iter().any(|c| c.is_stale) {
        "degraded".to_string()
    } else {
        "ok".to_string()
    };

    Ok(Json(MetricsResponse { cursors, status }))
}

/// GET /metrics/prometheus
///
/// Returns metrics in Prometheus text format for scraping.
/// This is a placeholder that delegates to the Prometheus exporter's
/// built-in HTTP listener on a separate port.
pub async fn prometheus_metrics_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        "# Prometheus metrics are exposed on the metrics port (default: 9090)\n\
         # Configure your Prometheus scraper to target that port instead.\n",
    )
}
