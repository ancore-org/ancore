# Runbook: HighMemoryUsage / ContainerOOMKilled

## Alert
Fires when memory usage exceeds 90% (critical) for 5 minutes, or when a container is OOMKilled.

## Severity & Escalation
- **Level:** critical
- **Escalation:** PagerDuty → on-call
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved)

## Diagnosis Steps
1. Check memory usage on the affected host:
```bash
# On the affected host
free -h
# Or
top -o %MEM
```
2. Check which processes are consuming memory:
```bash
ps aux --sort=-%MEM | head -20
```
3. Check for memory leaks in application logs
4. Check if memory limits are too low for the workload
5. Review recent deployments that may have introduced memory issues
6. Check Grafana dashboard for memory trends

## Remediation
- **Increase memory limits:** Update container resource limits
- **Restart service:** `kubectl rollout restart deploy/[service]` to clear memory leaks
- **Scale up services:** `kubectl scale deploy/[service] --replicas=N` to distribute load
- **Investigate memory leaks:** Use profiling tools to identify leaks
- **Optimize data structures:** Reduce memory footprint of operations
- **Add memory limits** to prevent runaway consumption

## Prevention
- Set appropriate memory limits and requests for all containers
- Implement memory profiling in development
- Add memory leak detection to CI/CD
- Use streaming processing instead of loading large datasets into memory
- Implement cache eviction policies
- Set up memory-based horizontal pod autoscaling

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review and adjust memory limits based on actual usage
- Add memory profiling to the development workflow
