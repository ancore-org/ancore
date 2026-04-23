# Runbook: HighP95Latency / HighP99Latency / LatencySpikeDetected

## Alert
Fires when P95 latency exceeds 500ms (warning) or P99 latency exceeds 2000ms (critical) for more than 5 minutes, or when latency suddenly doubles relative to the 1-hour baseline.

## Severity & Escalation
- **Level:** warning (P95) / critical (P99)
- **Escalation:** Slack (warning) / PagerDuty (critical)
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved for critical)

## Diagnosis Steps
1. Check service logs for slow operations:
```bash
# Kubernetes
kubectl logs -n ancore deploy/[service] --tail=500 --since=15m
# Look for slow query logs, timeout errors, etc.
```
2. Check database query performance
3. Check external API response times
4. Check CPU, memory, and disk I/O on affected hosts
5. Check network latency between services
6. Check Grafana dashboard: http://grafana:3000/d/ancore-service-overview

## Remediation
- **Scale up services:** `kubectl scale deploy/[service] --replicas=N`
- **Restart service:** `kubectl rollout restart deploy/[service]` to clear any stuck states
- **Optimize slow database queries** (add indexes, rewrite queries)
- **Add caching** for frequently accessed data
- **Implement connection pooling** for databases and external APIs
- **Check for resource contention** (CPU, memory, disk I/O)

## Prevention
- Set up database query monitoring and alerting
- Implement caching strategies (Redis, in-memory)
- Add performance regression tests to CI/CD
- Monitor database connection pool utilization
- Implement load testing for all deployments
- Use profiling tools to identify bottlenecks

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review SLO impact
- Add performance tests for the specific issue encountered
