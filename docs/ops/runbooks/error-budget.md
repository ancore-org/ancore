# Runbook: ErrorBudgetBurnRateHigh

## Alert
Fires when the error budget is burning 14.4× faster than allowed, which would exhaust the 28-day error budget within 2 days at the current rate. This is an early warning of an impending SLO breach.

## Severity & Escalation
- **Level:** warning
- **Escalation:** Slack #ancore-alerts
- **Escalation path:** On-call engineer → Platform lead (if not resolved in 2 hours)

## Diagnosis Steps
1. Check current error rate trend on Grafana dashboard
2. Identify which service is driving the burn rate
3. Check for recent deployments or configuration changes
4. Review error logs for patterns
5. Check if there's a specific endpoint or feature causing issues

## Remediation
- **Investigate immediately:** Even though this is a warning, fast action is critical
- **Roll back recent changes** if they correlate with the burn rate increase
- **Scale up services** if the issue is load-related
- **Implement rate limiting** if a specific endpoint is being abused
- **Add caching** to reduce load on expensive operations
- **Freeze non-critical deploys** until burn rate normalizes

## Prevention
- Set up automated rollback on error rate spikes
- Implement feature flags to quickly disable problematic features
- Add load testing to catch performance regressions before deployment
- Monitor error budget burn rate in daily standups
- Implement canary deployments for risky changes

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review SLO thresholds if they were unrealistic
- Conduct post-mortem to identify root cause
