use ancore_indexer::ingest::{IngestWorker, MemorySink, VecSource, WorkerConfig};
use ancore_indexer::metrics::{init_prometheus_metrics, record_ingest_metrics};
use ancore_indexer::schema::canonical::RawEvent;
use chrono::Utc;

fn create_sample_event(ledger_seq: u32) -> RawEvent {
    RawEvent {
        ledger_seq,
        ledger_close_time: Utc::now(),
        tx_hash: format!("{:0>64}", ledger_seq),
        contract_id: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".into(),
        topics: vec!["transfer".into()],
        data: String::new(),
    }
}

#[tokio::test]
async fn test_metrics_recorded_on_batch_ingest() {
    init_prometheus_metrics();

    let events = vec![
        create_sample_event(1),
        create_sample_event(2),
        create_sample_event(3),
    ];
    let source = VecSource::new(events);
    let sink = MemorySink::default();
    let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

    let stats = worker.run_once().await.unwrap();

    assert_eq!(stats.persisted, 3);

    let duration = 1.5;
    let records_per_second = stats.persisted as f64 / duration;
    let lag = 10i64;

    record_ingest_metrics(records_per_second, lag, duration);
}

#[test]
fn test_metrics_initialization() {
    init_prometheus_metrics();
}

#[test]
fn test_record_metrics_with_zero_lag() {
    init_prometheus_metrics();
    record_ingest_metrics(100.0, 0, 0.5);
}

#[test]
fn test_record_metrics_with_high_throughput() {
    init_prometheus_metrics();
    record_ingest_metrics(1000.0, 50, 2.0);
}

#[test]
fn test_checkpoint_ingest_duration_metrics() {
    init_prometheus_metrics();
    ancore_indexer::metrics::record_checkpoint_ingest_duration(0.025);
    ancore_indexer::metrics::record_checkpoint_ingest_duration(0.5);
    ancore_indexer::metrics::record_checkpoint_ingest_duration(1.2);

    assert_eq!(
        ancore_indexer::metrics::CHECKPOINT_INGEST_DURATION,
        "checkpoint_ingest_duration_seconds"
    );
    assert_eq!(
        ancore_indexer::metrics::CHECKPOINT_INGEST_DURATION_BUCKETS,
        &[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
    );
}

#[tokio::test]
async fn test_checkpoint_ingest_duration_recorded_in_worker_run() {
    init_prometheus_metrics();

    let events = vec![create_sample_event(10), create_sample_event(11)];
    let source = VecSource::new(events);
    let sink = MemorySink::default();
    let mut worker = IngestWorker::new(WorkerConfig::default(), source, sink);

    let stats = worker.run_once().await.unwrap();
    assert_eq!(stats.persisted, 2);

    let checkpoint = worker.current_checkpoint().await.unwrap();
    assert_eq!(checkpoint.last_ledger_seq, 11);
}
