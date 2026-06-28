# Ancore Ops

Versioned observability configuration for production deployments. Alert rules, dashboards, and SLO definitions are validated in CI.

## Contents

| Path | Purpose |
|------|---------|
| [slo-definitions.md](./slo-definitions.md) | SLI/SLO targets and error budget policy |
| [alertmanager.yml](./alertmanager.yml) | Alert routing and escalation config |
| [alerts/](./alerts/) | Prometheus alert rule files |
| [dashboards/](./dashboards/) | Grafana dashboard JSON models |

## Incident response

All alerts link to [docs/security/INCIDENT_RESPONSE.md](../security/INCIDENT_RESPONSE.md). Use that playbook for triage, communication, and recovery.

## Local setup

```bash
docker compose -f docker-compose.monitoring.yml up -d

# Grafana:      http://localhost:3000  (admin / admin)
# Prometheus:   http://localhost:9090
# Alertmanager: http://localhost:9093
```

## CI validation

PRs touching `docs/ops/` or `services/prometheus.yml` run:

- `promtool check rules` on all alert files
- `amtool check-config` on alertmanager config
- JSON schema validation on Grafana dashboards
- Verification that alerts include a runbook link and the incident response doc exists
