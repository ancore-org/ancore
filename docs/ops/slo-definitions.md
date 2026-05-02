# SLI/SLO Definitions — Ancore Mainnet

## Availability SLOs

| Service | SLI | SLO | Window |
|---------|-----|-----|--------|
| relayer | HTTP 2xx rate | 99.9% | 28d rolling |
| relayer | Health check passing | 99.95% | 28d rolling |
| indexer | HTTP 2xx rate | 99.9% | 28d rolling |
| indexer | Health check passing | 99.95% | 28d rolling |
| ai-agent | HTTP 2xx rate | 99.9% | 28d rolling |
| ai-agent | Health check passing | 99.95% | 28d rolling |

## Latency SLOs

| Service | P50 | P95 | P99 |
|---------|-----|-----|-----|
| relayer | < 100ms | < 500ms | < 2000ms |
| indexer | < 100ms | < 500ms | < 2000ms |
| ai-agent | < 100ms | < 500ms | < 2000ms |

## Error Rate SLOs

| Service | SLI | SLO |
|---------|-----|-----|
| relayer | 5xx rate | < 0.1% |
| indexer | 5xx rate | < 0.1% |
| ai-agent | 5xx rate | < 0.1% |

## Error Budget Policy
- 28-day error budget = (1 - SLO target) × 28 days × 24 hours
- At 50% consumed: notify on-call via Slack, begin investigation
- At 75% consumed: escalate to PagerDuty, freeze non-critical deploys
- At 100% consumed: full freeze, mandatory post-mortem within 48h

## Review Cadence
- Weekly: automated SLO report (GitHub Actions)
- Monthly: manual review and threshold tuning
- Post-incident: immediate SLO review if breach occurred
