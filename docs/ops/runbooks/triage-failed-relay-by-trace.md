# Runbook: Triage a Failed Relay Using Trace ID

## Goal
Given a failed relay request (user-facing error, alert firing, or support ticket), locate the trace in the observability stack and determine the root cause.

## Prerequisites
- Access to Grafana (http://grafana:3000, admin credentials from vault)
- Access to the trace backend (Jaeger or the OTLP-compatible store configured via `OTEL_EXPORTER_OTLP_ENDPOINT`)
- The **trace ID** from one of:
  - The `X-Request-Id` response header returned by the relay endpoint
  - The `trace_id` field in a structured log entry
  - The alert annotation in PagerDuty / Slack

## Steps

### 1. Locate the trace in your OTLP backend
```
1. Open Grafana → Explore → select the Tempo/Jaeger datasource
2. Search by trace ID (the full 32-hex-char ID from the X-Request-Id or log entry)
3. If trace is not found, extend the time range to ±1h of the reported failure time
```

### 2. Examine the span tree
Each relay request produces a root span and three child spans:

| Span Name               | What It Covers                                     |
|-------------------------|-----------------------------------------------------|
| `POST /relay/execute`   | Entire HTTP handler duration (auto-instrumentation)  |
| `relayer.validate`      | Signature verification + nonce check + policy check |
| `relayer.simulate`      | Soroban `simulateTransaction` RPC call              |
| `relayer.submit`        | Soroban `sendTransaction` RPC call                  |

Check each span for:
- **Span status**: `STATUS_CODE_ERROR` indicates which stage failed
- **Attributes**: `session_key_id`, `nonce`, `error.code`, `error.message`
- **Events**: exception stack traces recorded as span events

### 3. Identify the failure stage

#### a) Failure in `relayer.validate`
- **Typical errors**: `INVALID_SIGNATURE`, `NONCE_REPLAY`, `POLICY_DENIED`
- **Action**: Check `session_key_id` attribute; verify caller provided correct session key and signature
- **Dashboard**: Open the [Service Overview](http://grafana:3000/d/ancore-service-overview) → check `relay_validation_failures_total{code="INVALID_SIGNATURE"}`

#### b) Failure in `relayer.simulate`
- **Typical errors**: `SIMULATION_FAILED`, contract revert, state archival
- **Action**: Check the span event for the simulation error message. If state archival, run state restoration before retry
- **Metrics**: `relay_submit_duration_seconds_bucket` will show elevated values or no new observations

#### c) Failure in `relayer.submit`
- **Typical errors**: `RPC_DOWN`, `TX_FAILED`, network congestion
- **Action**: Check the `submit.latency_ms` attribute on the submit span. If >10s, Stellar RPC may be degraded
- **Alerts**: Check `StellarNodeBehind` or `TransactionFailureRateHigh` in Alertmanager

### 4. Cross-reference with metrics
```
1. Go to Grafana dashboard "Ancore — Service Overview"
2. Set the `service` variable to `relayer`
3. Check:
   - Error Rate panel: spike in `relay_errors_total`
   - Latency panel: P95/P99 of `relay_request_duration_seconds`
   - Error Budget panel: remaining budget percentage
```

### 5. Check mock mode
If the trace shows no `relayer.simulate` or `relayer.submit` spans, the service may be in mock mode:
```
relay_mock_mode == 1
```
This means transactions are not being submitted to Stellar. Check the deployment config for `RELAYER_USE_MOCK_SUBMISSION`.

### 6. Common resolutions

| Symptom                              | Likely Cause                         | Action                                                                 |
|--------------------------------------|--------------------------------------|------------------------------------------------------------------------|
| `relayer.validate` fails with `INVALID_SIGNATURE` | Wrong session key or bad signature   | Ask caller to re-sign with correct Ed25519 key                         |
| `relayer.simulate` fails with `SIMULATION_FAILED` | Contract revert or expired entry     | Check contract state, submit restore transaction first                  |
| `relayer.submit` fails with `RPC_DOWN` | Soroban RPC unreachable              | Restart Stellar RPC connection, check `services/prometheus.yml` targets |
| No trace found                       | Tracing not configured               | Verify `OTEL_ENABLED=true` and `OTEL_EXPORTER_OTLP_ENDPOINT` is set     |

### 7. Escalation
If root cause is not identified within 15 minutes:
- Follow [INCIDENT_RESPONSE.md](../../security/INCIDENT_RESPONSE.md)
- Tag `@platform` in Slack `#ancore-alerts`
- Include the trace ID and the failing span name in the escalation message
