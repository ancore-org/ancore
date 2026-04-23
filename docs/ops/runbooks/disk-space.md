# Runbook: DiskSpaceLow / DiskSpaceCritical

## Alert
Fires when disk space falls below 15% (warning) or 5% (critical) on any filesystem.

## Severity & Escalation
- **Level:** warning (15%) / critical (5%)
- **Escalation:** Slack (warning) / PagerDuty (critical)
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved for critical)

## Diagnosis Steps
1. Check disk usage on the affected host:
```bash
df -h
# Or
du -sh /* | sort -hr | head -20
```
2. Identify which directories are consuming the most space
3. Check log files for excessive growth
4. Check database storage usage
5. Check for temporary files or caches that can be cleaned
6. Review retention policies for logs and backups

## Remediation
- **Clean up logs:** Rotate or delete old log files
- **Clean up temporary files:** Remove temp directories and caches
- **Expand disk:** Increase disk size if possible
- **Move data:** Offload data to external storage (S3, etc.)
- **Adjust retention policies:** Reduce log retention time
- **Clean up Docker images:** Remove unused Docker images and containers
```bash
docker system prune -a
```

## Prevention
- Set up log rotation with size limits
- Implement automated cleanup of temporary files
- Monitor disk usage trends and set up alerts at 20%
- Use external storage for logs and backups (S3, etc.)
- Set up disk expansion automation
- Implement database archival for old data

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review and adjust retention policies
- Implement automated cleanup scripts if not already in place
