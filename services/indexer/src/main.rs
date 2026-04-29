use axum::{
    routing::get,
    Router,
};
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::str::FromStr;
use tower_governor::GovernorLayer;
use tower_governor::governor::GovernorConfigBuilder;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod error;
mod repositories;

use api::account_activity;
use api::health;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ancore_indexer=debug,tower_http=debug,axum=trace".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    dotenvy::dotenv().ok();

    // Configure rate limiting
    let per_second = std::env::var("RATE_LIMIT_PER_SECOND")
        .unwrap_or_else(|_| "10".to_string())
        .parse::<u64>()
        .unwrap_or(10);
    let burst_size = std::env::var("RATE_LIMIT_BURST_SIZE")
        .unwrap_or_else(|_| "20".to_string())
        .parse::<u32>()
        .unwrap_or(20);
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(per_second)
        .burst_size(burst_size)
        .finish()
        .unwrap();
    let governor_conf = Box::leak(Box::new(governor_conf));

    // Get database URL from environment
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // Get database timeout from environment (default to 30 seconds)
    let db_timeout_sec = std::env::var("DB_QUERY_TIMEOUT_SEC")
        .unwrap_or_else(|_| "30".to_string())
        .parse::<u64>()
        .unwrap_or(30);
    let db_timeout = std::time::Duration::from_secs(db_timeout_sec);

    // Create database connection options
    let mut connect_options = sqlx::postgres::PgConnectOptions::from_str(&database_url)
        .map_err(|e| anyhow::anyhow!("Invalid database URL: {}", e))?;

    // Set statement timeout (query level)
    connect_options = connect_options.options([("statement_timeout", format!("{}s", db_timeout_sec))]);

    // Create database connection pool
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(db_timeout)
        .connect_with(connect_options)
        .await?;

    tracing::info!("Connected to database");

    // Build our application with routes
    let app = Router::new()
        // Account activity query API
        .route(
            "/api/v1/accounts/:account_id/activity",
            get(account_activity::list_handler),
        )
        .route(
            "/api/v1/accounts/:account_id/activity/:activity_id",
            get(account_activity::get_by_id_handler),
        )
        .route(
            "/api/v1/accounts/:account_id/activity/types",
            get(account_activity::list_types_handler),
        )
        .route("/health", get(health::health_handler))
        .layer(GovernorLayer {
            config: governor_conf,
        })
        .layer(CorsLayer::permissive())
        .with_state(pool);

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
