# Runbook: ServiceDown

## Alert
Fires when any scraped target (relayer, indexer, ai-agent) has been unreachable for more than 1 minute. This indicates a service is completely down and not responding to health checks or metrics scraping.

## Severity & Escalation
- **Level:** critical
- **Escalation:** PagerDuty → on-call
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved)

## Diagnosis Steps
1. Check service logs:
```bash
# Kubernetes
kubectl logs -n ancore deploy/[service] --tail=100 --since=10m
# Docker
docker logs [container] --tail=100
```
2. Check recent deployments (last 30 minutes)?
3. Check infrastructure health (CPU, memory, disk on affected host)
4. Check downstream dependencies
5. Check Grafana dashboard: http://grafana:3000/d/ancore-service-overview

## Remediation
- **Restart service:** `kubectl rollout restart deploy/[service]`
- **Roll back:** `kubectl rollout undo deploy/[service]`
- **Scale up:** `kubectl scale deploy/[service] --replicas=N`
- Service-specific steps as relevant

## Prevention
- Implement health check endpoints for all services
- Add liveness and readiness probes in Kubernetes
- Set up automated rollback on deployment failure
- Monitor resource limits to prevent OOM kills

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review SLO impact
