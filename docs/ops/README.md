# Ancore Ops Documentation

Versioned observability configuration and incident response procedures for the ancore mainnet deployment.
All configs are code-reviewed and validated by CI before merge.

## Contents

| Path | Purpose |
|------|---------|
| [slo-definitions.md](./slo-definitions.md) | SLI/SLO targets and error budget policy |
| [alertmanager.yml](./alertmanager.yml) | Alert routing and escalation config |
| [alerts/](./alerts/) | Prometheus alert rule files |
| [dashboards/](./dashboards/) | Grafana dashboard JSON models |
| [runbooks/](./runbooks/) | Service-specific incident response guides |
| [incident-response-severity.md](./incident-response-severity.md) | Severity levels and communication protocols |
| [incident-owners-matrix.md](./incident-owners-matrix.md) | Incident response ownership and escalation |
| [tabletop-drill-checklist.md](./tabletop-drill-checklist.md) | Incident response drill scenarios |
| [incident-response-success-criteria.md](./incident-response-success-criteria.md) | Success metrics and KPIs |

## Incident Response Overview

### Service-Specific Runbooks
- **[Wallet Incidents](./runbooks/wallet-incidents.md)** - Wallet service failures and user access issues
- **[Relayer Incidents](./runbooks/relayer-incidents.md)** - Transaction processing and gas fee issues
- **[Indexer Incidents](./runbooks/indexer-incidents.md)** - Data sync and database performance issues
- **[Contract Incidents](./runbooks/contract-incidents.md)** - Smart contract failures and security incidents

### Core Infrastructure Runbooks
- **[Service Down](./runbooks/service-down.md)** - Complete service unavailability
- **[High CPU/Memory](./runbooks/high-cpu.md)** - Resource utilization issues
- **[Stellar Sync](./runbooks/stellar-sync.md)** - Stellar node connectivity issues
- **[Transaction Failures](./runbooks/tx-failures.md)** - General transaction processing issues

## Alert Severity Reference

| Severity | Escalation | Response Target | Use Cases |
|----------|-----------|----------------|-----------|
| critical | PagerDuty → on-call | < 15 minutes | Service outage, security breach, fund loss risk |
| warning  | Slack #ancore-alerts | < 2 hours | Performance degradation, elevated error rates |

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

## Incident Response Process

### Initial Response
1. **Alert Received:** PagerDuty or Slack notification based on severity
2. **Acknowledge Alert:** Within 5 minutes (critical) or 15 minutes (warning)
3. **Create Incident Channel:** `#incident-[service]-[timestamp]` format
4. **Assess Impact:** Determine scope and user impact
5. **Declare Incident:** Formal declaration with severity level

### Triage and Investigation
1. **Follow Service-Specific Runbook:** Use appropriate runbook for incident type
2. **Gather Context:** Check logs, metrics, and recent changes
3. **Identify Root Cause:** Systematic diagnosis using runbook steps
4. **Communicate Status:** Regular updates to stakeholders

### Resolution and Recovery
1. **Implement Fix:** Apply remediation from runbook
2. **Verify Resolution:** Confirm service restoration
3. **Update Status:** Communicate resolution to all stakeholders
4. **Post-Incident Review:** Complete incident report within 24 hours

### Ongoing Improvement
- **Monthly Drills:** Practice incident response scenarios
- **Quarterly Reviews:** Update procedures based on lessons learned
- **Annual Audits:** Complete review of incident response program

## Adding a New Alert

1. Add the rule to the appropriate `alerts/*.yml` file
2. Create `runbooks/[alert-name-kebab].md` using the runbook template
3. Add the `runbook_url` annotation pointing to the new runbook
4. Run `promtool check rules docs/ops/alerts/[file].yml` locally
5. CI validates automatically on PR open

## Adding a New Service Runbook

1. Create service-specific runbook in `runbooks/` directory
2. Follow the established template structure:
   - Alert description and severity
   - Triage flow with time-based steps
   - Common incident types and remediation
   - Prevention measures and monitoring
3. Update this README with new runbook link
4. Update incident owners matrix if needed
5. Test runbook in tabletop drill scenarios

## Emergency Contacts

| Situation | Contact | Method |
|-----------|---------|--------|
| **Critical Security Incident** | Security Team | PagerDuty + Slack @security-team |
| **Service Outage** | On-Call Engineer | PagerDuty |
| **Infrastructure Failure** | Platform Team | Slack @platform-team |
| **User Safety Concern** | Leadership Team | PagerDuty + Phone |

## Training and Certification

All incident response team members must:
- Complete incident response training (quarterly)
- Participate in monthly tabletop drills
- Maintain current certification for their service area
- Review and acknowledge runbook updates

For more information, see the [Incident Response Success Criteria](./incident-response-success-criteria.md) and [Tabletop Drill Checklist](./tabletop-drill-checklist.md).
