# Relayer Health Check

This document describes the health check endpoints and their integration with orchestrators like Docker Compose and Kubernetes.

## Endpoints

### GET /health

Comprehensive health check with dependency probing.

**Response Codes:**
- `200 OK`: All critical dependencies are healthy
- `503 Service Unavailable`: One or more dependencies are degraded

**Response Body:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "dependencies": {
    "queue": {
      "status": "ok"
    },
    "rpc": {
      "status": "ok",
      "latencyMs": 50
    },
    "storage": {
      "status": "ok"
    },
    "signatureService": {
      "status": "ok",
      "latencyMs": 10
    }
  }
}
```

### GET /relay/status

Legacy health endpoint without async dependency probing.

**Response:** Always returns `200 OK` with current dependency states.

## Dependency Status

Each dependency reports:
- `status`: `"ok"` or `"degraded"`
- `message`: Optional human-readable status message
- `latencyMs`: Optional probe latency for async checks

### Critical Dependencies

The service is considered unhealthy if **any** of these are degraded:
- `queue`: Job queue for async processing
- `rpc`: Soroban RPC endpoint for transaction submission
- `storage`: Idempotency store
- `signatureService`: Signature verification backend (KMS)

## Signature Service Health

The signature service probe:
- Calls `SignatureServiceContract.isHealthy()` if implemented
- Times out after configurable duration (default: 5000ms)
- Reports latency for monitoring

### Configuration

Set the probe timeout via environment variable:
```bash
SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS=5000
```

### Degraded vs Healthy Semantics

- **Healthy (`status: "ok"`)**: Dependency probe succeeded within timeout
- **Degraded (`status: "degraded"`)**: Probe failed, timed out, or returned unhealthy

## Docker Compose Integration

Compatible with `docker-compose.yml` health check configuration:

```yaml
services:
  relayer:
    image: ancore/relayer:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Health Check Behavior

- **interval**: How often to probe (30s recommended)
- **timeout**: Max time to wait for response (10s recommended)
- **retries**: Number of consecutive failures before marking unhealthy
- **start_period**: Grace period during startup (adjust based on initialization time)

## Kubernetes Integration

Compatible with Kubernetes liveness and readiness probes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: relayer
spec:
  containers:
  - name: relayer
    image: ancore/relayer:latest
    livenessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 30
      periodSeconds: 30
      timeoutSeconds: 10
      failureThreshold: 3
    readinessProbe:
      httpGet:
        path: /health
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 2
```

### Probe Configuration

- **livenessProbe**: Restarts the container if failing
  - Use longer intervals (30s) to avoid restart thrashing
  - Higher failure threshold (3) for transient network issues

- **readinessProbe**: Removes pod from service endpoints if failing
  - Shorter intervals (10s) for faster traffic exclusion
  - Lower failure threshold (2) for quick response to degradation

## Monitoring Integration

### Prometheus Alerts

```yaml
groups:
  - name: relayer_health
    rules:
      - alert: RelayerUnhealthy
        expr: up{job="relayer"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Relayer service is down"

      - alert: RelayerDegraded
        expr: relayer_health_status{status="degraded"} == 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Relayer dependency degraded"
          description: "{{ $labels.dependency }} is degraded"
```

### Health Check Metrics

The `/metrics` endpoint exposes health-related metrics:
- `relayer_health_status`: Overall health status (0=ok, 1=degraded)
- `relayer_dependency_status{dependency="signatureService"}`: Per-dependency status
- `relayer_dependency_latency_ms{dependency="signatureService"}`: Probe latency

## Testing

### Manual Health Check

```bash
curl -i http://localhost:3000/health
```

Expected response when healthy:
```
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok","uptime":120,"timestamp":"2024-01-15T10:30:00.000Z",...}
```

Expected response when degraded:
```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{"status":"degraded","uptime":120,"timestamp":"2024-01-15T10:30:00.000Z",...}
```

### Unit Tests

See `tests/unit/health.test.ts` for comprehensive test coverage:
- Dependency probing with mocked failures
- Timeout handling
- Status code validation
- Response schema verification

## Troubleshooting

### Service Reports Degraded

1. Check dependency statuses in response body
2. Inspect logs for probe errors
3. Verify network connectivity to RPC and KMS
4. Check timeout configuration

### Health Check Timeout

1. Increase `SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS`
2. Verify signature service responsiveness
3. Check network latency to KMS backend

### False Positives

1. Review failure threshold in orchestrator config
2. Increase probe interval to reduce load
3. Add grace period during startup
