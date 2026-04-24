# Runbook: Wallet Incidents

## Alert
Fires when wallet services (extension, mobile, web) experience critical errors, high failure rates, or service degradation affecting user access to accounts and funds.

## Severity & Escalation
- **Level:** critical (service unavailable) / warning (degraded performance)
- **Escalation:** PagerDuty (critical) / Slack #ancore-alerts (warning)
- **Escalation path:** On-call engineer → Wallet lead → CTO (> 30 min unresolved)

## Triage Flow

### 1. Immediate Assessment (0-5 minutes)
- **Check service status:**
  ```bash
  # Extension wallet backend
  kubectl logs -n ancore deploy/wallet-backend --tail=50 --since=5m
  
  # Mobile wallet API
  kubectl logs -n ancore deploy/mobile-wallet-api --tail=50 --since=5m
  
  # Web dashboard
  kubectl logs -n ancore deploy/web-dashboard --tail=50 --since=5m
  ```
- **Verify incident scope:** Single user vs widespread outage
- **Check recent deployments** in the last 30 minutes
- **Assess user impact:** Can users access funds? Can they sign transactions?

### 2. Quick Diagnosis (5-15 minutes)
- **Check error rates** in Grafana: http://grafana:3000/d/wallet-overview
- **Verify Stellar network connectivity** from wallet services
- **Check database connectivity** and query performance
- **Review authentication/authorization** service status
- **Check third-party dependencies** (infura, stellar RPC endpoints)

### 3. Deep Investigation (15+ minutes)
- **Analyze error patterns** in application logs
- **Check for database locks** or connection pool exhaustion
- **Review recent code changes** that might affect wallet functionality
- **Check memory usage** and potential OOM kills
- **Verify session key service** functionality

## Common Incident Types

### Wallet Connection Failed
**Symptoms:** Users cannot connect wallet, timeout errors
**Diagnosis:**
```bash
# Check Stellar RPC connectivity
curl -X POST https://horizon.stellar.org -d '{"jsonrpc":"2.0","method":"getLedgerInfo","params":[],"id":1}'

# Check wallet service health
kubectl exec -it deploy/wallet-backend -- curl http://localhost:3000/health
```
**Remediation:**
- Restart wallet backend service
- Update Stellar RPC endpoints if needed
- Implement circuit breaker for failed connections

### Transaction Signing Failed
**Symptoms:** Users cannot sign transactions, signing errors
**Diagnosis:**
```bash
# Check session key service
kubectl logs -n ancore deploy/session-key-service --tail=100

# Verify validation modules are responsive
kubectl exec -it deploy/wallet-backend -- curl http://localhost:3000/api/v1/validation-modules/status
```
**Remediation:**
- Restart session key service
- Check validation module deployment status
- Verify account contract availability

### Balance Display Issues
**Symptoms:** Incorrect balances, missing funds
**Diagnosis:**
```bash
# Check indexer connectivity
kubectl logs -n ancore deploy/indexer --tail=50

# Verify database queries are executing
kubectl exec -it deploy/wallet-backend -- psql -c "SELECT COUNT(*) FROM account_balances;"
```
**Remediation:**
- Restart indexer service
- Clear balance cache
- Re-sync affected accounts

## Remediation Actions

### Immediate Actions
- **Restart affected services:**
  ```bash
  kubectl rollout restart deploy/wallet-backend
  kubectl rollout restart deploy/mobile-wallet-api
  kubectl rollout restart deploy/web-dashboard
  ```
- **Roll back recent deployment** if timing suggests correlation
- **Scale up services** if resource constrained
- **Enable maintenance mode** if data corruption suspected

### Service-Specific Actions
- **Extension wallet:** Clear session cache, restart backend
- **Mobile wallet:** Check API gateway, restart mobile API
- **Web dashboard:** Verify CDN status, restart web service

### Database Issues
- **Check connection pool:** `kubectl exec -it deploy/wallet-backend -- psql -c "SELECT * FROM pg_stat_activity;"`
- **Restart database connections:** `kubectl rollout restart deploy/postgres`
- **Run database maintenance:** `VACUUM ANALYZE;`

## Prevention Measures
- Implement comprehensive health checks for all wallet services
- Set up automated rollback on deployment failures
- Add rate limiting to prevent abuse
- Implement circuit breakers for external dependencies
- Regularly test disaster recovery procedures
- Monitor key metrics: transaction success rate, login success rate, API response times

## Communication Protocol

### Critical Incidents
- **Immediate:** Slack #ancore-alerts with incident summary
- **5 minutes:** Create incident channel #incident-[timestamp]
- **15 minutes:** Post status page update
- **30 minutes:** Send user notification if widespread

### Warning Incidents
- **Immediate:** Slack #ancore-alerts
- **1 hour:** Status page update if ongoing
- **4 hours:** Resolution update or escalation

## Post-Incident Actions
- File incident report within 24 hours
- Update this runbook with new findings
- Review monitoring gaps and add alerts
- Conduct blameless post-mortem with team
- Update prevention measures based on root cause
- Test remediation procedures in staging environment

## Success Criteria
- **Resolution Time:** < 30 minutes for critical incidents
- **Service Restoration:** 100% functionality restored
- **User Impact:** Minimal (< 5% users affected) for warning incidents
- **Documentation:** Complete incident report filed
- **Prevention:** At least one preventive measure implemented
