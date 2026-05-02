# Runbook: HighCPUUsage / CriticalCPUUsage

## Alert
Fires when CPU usage exceeds 85% (warning) for 10 minutes or 95% (critical) for 5 minutes on any instance.

## Severity & Escalation
- **Level:** warning (85%) / critical (95%)
- **Escalation:** Slack (warning) / PagerDuty (critical)
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved for critical)

## Diagnosis Steps
1. Check which processes are consuming CPU:
```bash
# On the affected host
top -o %CPU
# Or
ps aux --sort=-%cpu | head -20
```
2. Check if it's a specific service or system process
3. Check for runaway processes or infinite loops
4. Check if there's a traffic spike or DDoS attack
5. Review recent deployments or code changes
6. Check Grafana dashboard for CPU trends

## Remediation
- **Scale up services:** `kubectl scale deploy/[service] --replicas=N`
- **Restart stuck services:** `kubectl rollout restart deploy/[service]`
- **Kill runaway processes:** Identify and terminate the offending process
- **Implement rate limiting** if traffic spike is the cause
- **Optimize code** if a specific operation is CPU-intensive
- **Add horizontal pod autoscaler** to automatically scale based on CPU

## Prevention
- Implement horizontal pod autoscaling (HPA) based on CPU metrics
- Set up CPU limits and requests for all containers
- Add rate limiting to prevent abuse
- Implement caching to reduce computational load
- Profile and optimize CPU-intensive code paths
- Set up DDoS protection

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review resource limits and adjust if needed
- Consider implementing auto-scaling if not already in place
