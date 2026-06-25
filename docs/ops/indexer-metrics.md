# Indexer Metrics

This document describes the Prometheus metrics exposed by the indexer service for operational monitoring and alerting.

## Available Metrics

### Lag Metrics

#### `indexer_lag_blocks`
**Type:** Gauge  
**Description:** Number of ledgers behind chain head  
**Usage:** Monitor how far behind the indexer is from the current blockchain state

**Example PromQL:**
```promql
indexer_lag_blocks > 100
```

#### `indexer_lag_seconds`
**Type:** Gauge  
**Description:** Estimated seconds behind chain head  
**Usage:** Time-based lag measurement for alerting

**Example PromQL:**
```promql
indexer_lag_seconds > 300
```

### Ingest Worker Metrics

#### `indexer_ingest_lag_ledgers`
**Type:** Gauge  
**Description:** Number of ledgers between cursor and network head  
**Usage:** Monitor the current lag between the ingest worker cursor position and the network head

**Example PromQL:**
```promql
indexer_ingest_lag_ledgers > 50
```

#### `indexer_ingest_records_per_second`
**Type:** Histogram  
**Description:** Ingestion throughput in records per second  
**Buckets:** Suitable for batch sizes typically used in production (0-1000+ records/sec)  
**Usage:** Track ingestion performance and identify throughput degradation

**Example PromQL:**
```promql
# Average ingestion rate over 5 minutes
rate(indexer_ingest_records_per_second_sum[5m]) / rate(indexer_ingest_records_per_second_count[5m])

# P95 ingestion rate
histogram_quantile(0.95, rate(indexer_ingest_records_per_second_bucket[5m]))
```

#### `indexer_ingest_batch_duration_seconds`
**Type:** Histogram  
**Description:** Duration of ingest batch processing  
**Usage:** Monitor batch processing performance and detect slowdowns

**Example PromQL:**
```promql
# P99 batch duration
histogram_quantile(0.99, rate(indexer_ingest_batch_duration_seconds_bucket[5m]))

# Average batch duration
rate(indexer_ingest_batch_duration_seconds_sum[5m]) / rate(indexer_ingest_batch_duration_seconds_count[5m])
```

## Grafana Dashboard Panels

### Recommended Panel Configuration

#### Throughput Panel
```json
{
  "title": "Ingest Throughput (records/sec)",
  "targets": [
    {
      "expr": "rate(indexer_ingest_records_per_second_sum[5m]) / rate(indexer_ingest_records_per_second_count[5m])",
      "legendFormat": "avg throughput"
    },
    {
      "expr": "histogram_quantile(0.95, rate(indexer_ingest_records_per_second_bucket[5m]))",
      "legendFormat": "p95 throughput"
    }
  ]
}
```

#### Lag Panel
```json
{
  "title": "Indexer Lag",
  "targets": [
    {
      "expr": "indexer_ingest_lag_ledgers",
      "legendFormat": "lag (ledgers)"
    },
    {
      "expr": "indexer_lag_seconds",
      "legendFormat": "lag (seconds)"
    }
  ]
}
```

#### Batch Duration Panel
```json
{
  "title": "Batch Processing Duration",
  "targets": [
    {
      "expr": "histogram_quantile(0.50, rate(indexer_ingest_batch_duration_seconds_bucket[5m]))",
      "legendFormat": "p50"
    },
    {
      "expr": "histogram_quantile(0.95, rate(indexer_ingest_batch_duration_seconds_bucket[5m]))",
      "legendFormat": "p95"
    },
    {
      "expr": "histogram_quantile(0.99, rate(indexer_ingest_batch_duration_seconds_bucket[5m]))",
      "legendFormat": "p99"
    }
  ]
}
```

## Alert Examples

### High Lag Alert
```yaml
alert: IndexerHighLag
expr: indexer_ingest_lag_ledgers > 100
for: 5m
labels:
  severity: warning
annotations:
  summary: "Indexer is falling behind"
  description: "Indexer lag is {{ $value }} ledgers behind network head"
```

### Low Throughput Alert
```yaml
alert: IndexerLowThroughput
expr: rate(indexer_ingest_records_per_second_sum[5m]) / rate(indexer_ingest_records_per_second_count[5m]) < 10
for: 10m
labels:
  severity: warning
annotations:
  summary: "Indexer ingestion throughput is low"
  description: "Current throughput is {{ $value | humanize }} records/sec"
```

### Slow Batch Processing Alert
```yaml
alert: IndexerSlowBatchProcessing
expr: histogram_quantile(0.95, rate(indexer_ingest_batch_duration_seconds_bucket[5m])) > 30
for: 5m
labels:
  severity: warning
annotations:
  summary: "Indexer batch processing is slow"
  description: "P95 batch duration is {{ $value | humanize }}s"
```

## Scrape Configuration

Add the following to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'indexer'
    scrape_interval: 15s
    static_configs:
      - targets: ['indexer:9090']
    metrics_path: '/metrics'
```

## Implementation Notes

- All histogram metrics use dynamic bucketing based on observed values
- Metrics are recorded on every batch completion in the ingest worker
- Lag gauges are updated based on checkpoint position relative to network head
- Metrics endpoint is exposed on the same port as the main service at `/metrics`
