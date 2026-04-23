# Ancore Ops Documentation

Versioned observability configuration for the ancore mainnet deployment.
All configs are code-reviewed and validated by CI before merge.

## Contents

| Path | Purpose |
|------|---------|
| [slo-definitions.md](./slo-definitions.md) | SLI/SLO targets and error budget policy |
| [alertmanager.yml](./alertmanager.yml) | Alert routing and escalation config |
| [alerts/](./alerts/) | Prometheus alert rule files |
| [dashboards/](./dashboards/) | Grafana dashboard JSON models |
| [runbooks/](./runbooks/) | Step-by-step response guides |

## Alert Severity Reference

| Severity | Escalation | Response Target |
|----------|-----------|----------------|
| critical | PagerDuty → on-call | < 15 minutes |
| warning  | Slack #ancore-alerts | < 2 hours |

## Local Setup

```bash
# Start the monitoring stack locally
docker-compose -f docker-compose.monitoring.yml up -d

# Grafana:      http://localhost:3000  (admin / admin)
# Prometheus:   http://localhost:9090
# Alertmanager: http://localhost:9093
```

## CI Validation

Every PR touching `docs/ops/` or `services/prometheus.yml` runs:
- `promtool check rules` on all alert files
- `amtool check-config` on alertmanager config
- JSON schema validation on all Grafana dashboards
- Runbook link verification (every alert must link to an existing runbook)

## Adding a New Alert

1. Add the rule to the appropriate `alerts/*.yml` file
2. Create `runbooks/[alert-name-kebab].md` using the runbook template
3. Add the `runbook_url` annotation pointing to the new runbook
4. Run `promtool check rules docs/ops/alerts/[file].yml` locally
5. CI validates automatically on PR open
