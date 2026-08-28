use axum::{routing::get, Router};
use clap::{Parser, Subcommand};
use metrics_exporter_prometheus::PrometheusBuilder;
use sqlx::postgres::{PgPool, PgPoolOptions};
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

/// Ancore indexer: serves the read API and (optionally) runs live ingest by
/// default, or runs a one-shot recovery command when a subcommand is given.
#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Serve the read API and live ingest worker (default behavior).
    Serve,
    /// Reprocess a specific ledger range from the RPC source into Postgres.
    ///
    /// Does not touch the live ingest checkpoint — the range comes from the
    /// CLI args, not the cursor — so it's safe to run alongside a running
    /// worker.
    Backfill {
        /// First ledger sequence to include (inclusive).
        #[arg(long)]
        from: u32,
        /// Last ledger sequence to include (inclusive).
        #[arg(long)]
        to: u32,
        /// Number of ledgers to request per batch from the source.
        #[arg(long, default_value_t = 500)]
        batch_size: usize,
    },
    /// Reprocess dead-lettered events that previously failed normalisation.
    ///
    /// Replays stored raw payloads by row id, not by ledger cursor, so this
    /// also never touches the live ingest checkpoint.
    ReprocessDeadLetters {
        /// Maximum number of pending dead-letter rows to reprocess in this run.
        #[arg(long, default_value_t = 100)]
        limit: i64,
    },
}

/// Build a Postgres connection pool the same way regardless of which command
/// is running — shared by `serve`, `backfill`, and `reprocess-dead-letters`.
async fn connect_pool() -> anyhow::Result<PgPool> {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    let db_timeout_sec = std::env::var("DB_QUERY_TIMEOUT_SEC")
        .unwrap_or_else(|_| "30".to_string())
        .parse::<u64>()
        .unwrap_or(30);
    let db_timeout = std::time::Duration::from_secs(db_timeout_sec);

    let mut connect_options = sqlx::postgres::PgConnectOptions::from_str(&database_url)
        .map_err(|e| anyhow::anyhow!("Invalid database URL: {}", e))?;
    connect_options =
        connect_options.options([("statement_timeout", format!("{}s", db_timeout_sec))]);

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(db_timeout)
        .connect_with(connect_options)
        .await?;

    tracing::info!("Connected to database");
    Ok(pool)
}

/// Build the same real `RpcEventSource` the live ingest worker uses, from
/// `SOROBAN_RPC_URL`/`SOROBAN_CONTRACT_IDS` — shared by `serve` and `backfill`
/// so there's exactly one place that reads this config.
fn rpc_source_from_env() -> anyhow::Result<ancore_indexer::ingest::RpcEventSource> {
    let rpc_url = std::env::var("SOROBAN_RPC_URL")
        .map_err(|_| anyhow::anyhow!("SOROBAN_RPC_URL must be set for this command"))?;
    let contract_ids = std::env::var("SOROBAN_CONTRACT_IDS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();
    if contract_ids.is_empty() {
        tracing::warn!(
            "SOROBAN_CONTRACT_IDS is not set — fetching events from ALL contracts, \
             which is almost certainly not what you want in production"
        );
    }

    Ok(ancore_indexer::ingest::RpcEventSource::new(
        ancore_indexer::ingest::RpcSourceConfig {
            rpc_url,
            contract_ids,
        },
    ))
}

async fn run_backfill(from: u32, to: u32, batch_size: usize) -> anyhow::Result<()> {
    let pool = connect_pool().await?;
    let source = rpc_source_from_env()?;
    let sink = ancore_indexer::ingest::PostgresEventSink::new(pool);

    let cmd = ancore_indexer::ingest::BackfillCommand::new(
        ancore_indexer::ingest::BackfillConfig {
            from_ledger: from,
            to_ledger: to,
            batch_size,
        },
        source,
        sink,
    );

    let stats = cmd.run().await?;
    tracing::info!(
        fetched = stats.fetched,
        persisted = stats.persisted,
        out_of_range = stats.out_of_range,
        errors = stats.errors,
        "backfill finished"
    );
    println!("{:#?}", stats);
    Ok(())
}

async fn run_reprocess_dead_letters(limit: i64) -> anyhow::Result<()> {
    let pool = connect_pool().await?;
    let mut store = ancore_indexer::ingest::PostgresDeadLetterStore::new(pool.clone());
    let mut sink = ancore_indexer::ingest::PostgresEventSink::new(pool);

    let stats =
        ancore_indexer::ingest::reprocess_dead_letters(&mut store, &mut sink, limit).await?;
    tracing::info!(
        candidates = stats.candidates,
        persisted = stats.persisted,
        normalise_failed = stats.normalise_failed,
        "dead-letter reprocessing finished"
    );
    println!("{:#?}", stats);
    Ok(())
}

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

    match Cli::parse().command {
        None | Some(Command::Serve) => {}
        Some(Command::Backfill {
            from,
            to,
            batch_size,
        }) => return run_backfill(from, to, batch_size).await,
        Some(Command::ReprocessDeadLetters { limit }) => {
            return run_reprocess_dead_letters(limit).await
        }
    }

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

    // Connect to the database (shared with the backfill/reprocess commands above).
    let pool = connect_pool().await?;

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
    match rpc_source_from_env() {
        Ok(source) => {
            let poll_interval_secs = std::env::var("INGEST_POLL_INTERVAL_SECS")
                .ok()
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(5);

            let sink = ancore_indexer::ingest::PostgresEventSink::new(pool.clone());
            let checkpoint_store =
                ancore_indexer::ingest::PostgresCheckpointStore::new(pool.clone());
            let dead_letters = ancore_indexer::ingest::PostgresDeadLetterStore::new(pool.clone());

            let mut worker = ancore_indexer::ingest::IngestWorker::with_checkpoint_store(
                ancore_indexer::ingest::WorkerConfig::default(),
                source,
                sink,
                checkpoint_store,
            )
            .with_dead_letter_store(dead_letters)
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
                                    dead_lettered = stats.dead_lettered,
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
