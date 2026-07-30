use axum::{routing::get, Router};
use metrics_exporter_prometheus::PrometheusBuilder;
use sqlx::postgres::PgPoolOptions;
use std::net::SocketAddr;
use std::str::FromStr;
use tower_governor::governor::GovernorConfigBuilder;
use tower_governor::GovernorLayer;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use ancore_indexer::ingest::CheckpointStore;
use ancore_indexer::metrics;

use ancore_indexer::api::account_activity;
use ancore_indexer::api::contract_events;
use ancore_indexer::api::health;
use ancore_indexer::api::metrics::{metrics_handler, prometheus_metrics_handler};
use ancore_indexer::api::statements;

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

    // Initialize Prometheus metrics exporter
    let prometheus_port = std::env::var("PROMETHEUS_PORT")
        .unwrap_or_else(|_| "9090".to_string())
        .parse::<u16>()
        .unwrap_or(9090);

    PrometheusBuilder::new()
        .with_http_listener(SocketAddr::from(([0, 0, 0, 0], prometheus_port)))
        .install()
        .expect("failed to install Prometheus exporter");

    tracing::info!("Prometheus metrics available on port {}", prometheus_port);

    // Initialize metric descriptions
    metrics::init_prometheus_metrics();

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
    connect_options =
        connect_options.options([("statement_timeout", format!("{}s", db_timeout_sec))]);

    // Create database connection pool
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(db_timeout)
        .connect_with(connect_options)
        .await?;

    tracing::info!("Connected to database");

    // Load ingest checkpoint cursor on startup for durable resume.
    let checkpoint_store = ancore_indexer::ingest::PostgresCheckpointStore::new(pool.clone());
    match checkpoint_store.load("main").await {
        Ok(Some(cp)) => tracing::info!(
            stream = %cp.stream,
            last_ledger_seq = cp.last_ledger_seq,
            "ingest checkpoint loaded"
        ),
        Ok(None) => tracing::info!("no ingest checkpoint found, starting fresh"),
        Err(err) => tracing::warn!(error = %err, "failed to load ingest checkpoint"),
    }

    // Start the ingestion worker (issue #996): every other piece of this
    // pipeline — checkpointing, the sink, cursor pagination on the read
    // side — was already built and tested, but nothing ever actually
    // pulled events from a real network. Gated on SOROBAN_RPC_URL so a
    // deployment that hasn't configured an RPC endpoint yet still starts
    // and serves the read API (just with nothing new to ingest), rather
    // than failing to boot.
    match std::env::var("SOROBAN_RPC_URL") {
        Ok(rpc_url) => {
            let contract_ids = std::env::var("SOROBAN_CONTRACT_IDS")
                .unwrap_or_default()
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            if contract_ids.is_empty() {
                tracing::warn!(
                    "SOROBAN_CONTRACT_IDS is not set — ingesting events from ALL contracts, \
                     which is almost certainly not what you want in production"
                );
            }

            let poll_interval_secs = std::env::var("INGEST_POLL_INTERVAL_SECS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(5);

            let source = ancore_indexer::ingest::RpcEventSource::new(
                ancore_indexer::ingest::RpcSourceConfig {
                    rpc_url,
                    contract_ids,
                },
            );
            let sink = ancore_indexer::ingest::PostgresEventSink::new(pool.clone());
            let checkpoint_store =
                ancore_indexer::ingest::PostgresCheckpointStore::new(pool.clone());

            let mut worker = ancore_indexer::ingest::IngestWorker::with_checkpoint_store(
                ancore_indexer::ingest::WorkerConfig::default(),
                source,
                sink,
                checkpoint_store,
            )
            .bootstrap_from_store()
            .await?;

            tokio::spawn(async move {
                let mut interval =
                    tokio::time::interval(std::time::Duration::from_secs(poll_interval_secs));
                loop {
                    interval.tick().await;
                    match worker.run_once().await {
                        Ok(stats) => {
                            if stats.fetched > 0 {
                                tracing::info!(
                                    fetched = stats.fetched,
                                    skipped = stats.skipped,
                                    normalised = stats.normalised,
                                    persisted = stats.persisted,
                                    errors = stats.errors,
                                    "ingest batch complete"
                                );
                            }
                        }
                        Err(err) => {
                            tracing::error!(error = %err, "ingest batch failed, will retry next tick");
                        }
                    }
                }
            });

            tracing::info!(interval_secs = poll_interval_secs, "ingest worker started");
        }
        Err(_) => {
            tracing::warn!(
                "SOROBAN_RPC_URL not set — ingest worker disabled, serving read API only"
            );
        }
    }

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
        .route(
            "/api/v1/accounts/:account_id/statements/rows",
            get(statements::rows_handler),
        )
        // Contract events API
        .route(
            "/api/v1/contract-events",
            get(contract_events::list_handler),
        )
        .route(
            "/api/v1/contract-events/:event_id",
            get(contract_events::get_by_id_handler),
        )
        .route(
            "/api/v1/contract-events/types",
            get(contract_events::list_types_handler),
        )
        .route("/health", get(health::health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/metrics/prometheus", get(prometheus_metrics_handler))
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
