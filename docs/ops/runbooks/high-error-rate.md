# Runbook: HighErrorRate

## Alert
Fires when the 5xx error rate exceeds 0.1% (SLO threshold) for more than 5 minutes. This indicates the service is returning server errors at a rate that will breach the SLO.

## Severity & Escalation
- **Level:** critical
- **Escalation:** PagerDuty → on-call
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved)

## Diagnosis Steps
1. Check service logs for error patterns:
```bash
# Kubernetes
kubectl logs -n ancore deploy/[service] --tail=500 --since=15m | grep -i error
# Docker
docker logs [container] --tail=500 | grep -i error
```
2. Check recent deployments or configuration changes
3. Check downstream dependencies (database, external APIs, Stellar network)
4. Check Grafana dashboard: http://grafana:3000/d/ancore-service-overview
5. Identify which endpoints are returning 5xx errors

## Remediation
- **Roll back recent deployment:** `kubectl rollout undo deploy/[service]`
- **Restart service:** `kubectl rollout restart deploy/[service]`
- **Scale up:** `kubectl scale deploy/[service] --replicas=N` to handle load
- Check and fix database connection issues
- Verify external API connectivity
- Service-specific debugging steps

## Prevention
- Implement circuit breakers for downstream dependencies
- Add retry logic with exponential backoff
- Monitor database connection pool health
- Implement load shedding under high load
- Add integration tests for error scenarios

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review SLO impact and adjust error budget
