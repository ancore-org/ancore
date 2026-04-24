# Runbook: Indexer Incidents

## Alert
Fires when the indexer service experiences sync failures, data inconsistencies, or service degradation affecting blockchain data availability for wallet and relayer services.

## Severity & Escalation
- **Level:** critical (sync stopped, data unavailable) / warning (sync lag, degraded performance)
- **Escalation:** PagerDuty (critical) / Slack #ancore-alerts (warning)
- **Escalation path:** On-call engineer → Indexer lead → CTO (> 30 min unresolved)

## Triage Flow

### 1. Immediate Assessment (0-5 minutes)
- **Check indexer service status:**
  ```bash
  # Indexer service logs
  kubectl logs -n ancore deploy/indexer --tail=50 --since=5m
  
  # Check sync status
  kubectl exec -it deploy/indexer -- curl http://localhost:3000/api/v1/sync/status
  ```
- **Verify incident scope:** Single table vs entire database
- **Check recent deployments** in the last 30 minutes
- **Assess user impact:** Can users see balances? Are transactions being indexed?

### 2. Quick Diagnosis (5-15 minutes)
- **Check sync lag** in Grafana: http://grafana:3000/d/indexer-overview
- **Verify database connectivity** and query performance
- **Check Stellar node connectivity** and ledger availability
- **Review error rates** by operation type
- **Check disk space** and database size

### 3. Deep Investigation (15+ minutes)
- **Analyze specific ledger processing** failures
- **Check for database locks** or connection pool exhaustion
- **Review data consistency** across tables
- **Check for reorg handling** and fork resolution
- **Verify indexing logic** for recent smart contract deployments

## Common Incident Types

### Indexer Sync Stalled
**Symptoms:** Sync progress stopped, increasing ledger gap
**Diagnosis:**
```bash
# Check current ledger vs network
kubectl exec -it deploy/indexer -- curl http://localhost:3000/api/v1/sync/status

# Check Stellar network latest ledger
curl https://horizon.stellar.org/ledgers?order=desc&limit=1

# Check for processing errors
kubectl logs -n ancore deploy/indexer --tail=100 | grep -i "error\|failed"
```
**Remediation:**
- Restart indexer service
- Check Stellar node connectivity
- Reset sync from last known good ledger
- Scale up indexer resources

### Database Performance Issues
**Symptoms:** Slow queries, connection timeouts, high CPU
**Diagnosis:**
```bash
# Check database connections
kubectl exec -it deploy/postgres -- psql -c "SELECT * FROM pg_stat_activity;"

# Check slow queries
kubectl exec -it deploy/postgres -- psql -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check database size
kubectl exec -it deploy/postgres -- psql -c "SELECT pg_size_pretty(pg_database_size('ancore'));"
```
**Remediation:**
- Restart database connections
- Add database indexes
- Scale up database resources
- Implement connection pooling

### Data Inconsistencies
**Symptoms:** Incorrect balances, missing transactions
**Diagnosis:**
```bash
# Check specific account balance
kubectl exec -it deploy/indexer -- curl http://localhost:3000/api/v1/accounts/[ACCOUNT_ID]

# Verify transaction exists
kubectl exec -it deploy/indexer -- curl http://localhost:3000/api/v1/transactions/[TX_HASH]

# Check data integrity
kubectl exec -it deploy/indexer -- curl http://localhost:3000/api/v1/admin/integrity-check
```
**Remediation:**
- Run data repair jobs
- Re-index affected ledgers
- Implement data validation checks
- Restore from backup if needed

### High Memory Usage
**Symptoms:** OOM kills, memory pressure alerts
**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n ancore

# Check indexer memory profile
kubectl exec -it deploy/indexer -- curl http://localhost:3000/debug/pprof/heap
```
**Remediation:**
- Increase memory limits
- Optimize batch processing size
- Implement memory-efficient data structures
- Add memory monitoring and alerts

## Remediation Actions

### Immediate Actions
- **Restart indexer service:**
  ```bash
  kubectl rollout restart deploy/indexer
  ```
- **Scale up resources** if needed:
  ```bash
  kubectl patch deploy/indexer -p '{"spec":{"template":{"spec":{"containers":[{"name":"indexer","resources":{"limits":{"memory":"4Gi","cpu":"2000m"}}}]}}}}'
  ```
- **Pause sync** if data corruption suspected:
  ```bash
  kubectl exec -it deploy/indexer -- curl -X POST http://localhost:3000/api/v1/sync/pause
  ```

### Database Operations
- **Check database health:**
  ```bash
  kubectl exec -it deploy/postgres -- psql -c "SELECT * FROM pg_stat_database WHERE datname = 'ancore';"
  ```
- **Run vacuum and analyze:**
  ```bash
  kubectl exec -it deploy/postgres -- psql -c "VACUUM ANALYZE;"
  ```
- **Rebuild indexes** if fragmented:
  ```bash
  kubectl exec -it deploy/postgres -- psql -c "REINDEX DATABASE ancore;"
  ```

### Sync Management
- **Reset sync from specific ledger:**
  ```bash
  kubectl exec -it deploy/indexer -- curl -X POST http://localhost:3000/api/v1/sync/reset -d '{"ledger":12345}'
  ```
- **Force re-index** of specific range:
  ```bash
  kubectl exec -it deploy/indexer -- curl -X POST http://localhost:3000/api/v1/sync/reindex -d '{"from":12345,"to":12355}'
  ```

## Prevention Measures
- Implement comprehensive sync monitoring
- Set up automated data integrity checks
- Add database performance monitoring
- Implement circuit breakers for Stellar node failures
- Regularly test disaster recovery procedures
- Monitor key metrics: sync lag, query performance, error rates

## Communication Protocol

### Critical Incidents
- **Immediate:** Slack #ancore-alerts with sync status
- **5 minutes:** Create incident channel #incident-indexer-[timestamp]
- **15 minutes:** Post status page update about data availability
- **30 minutes:** Send user notification if balance display affected

### Warning Incidents
- **Immediate:** Slack #ancore-alerts with performance degradation
- **1 hour:** Status page update if ongoing
- **4 hours:** Resolution update or escalation

## Post-Incident Actions
- File incident report within 24 hours
- Update this runbook with new findings
- Review monitoring gaps and add alerts
- Conduct blameless post-mortem with indexer team
- Update data validation procedures
- Test remediation procedures in staging environment

## Success Criteria
- **Resolution Time:** < 30 minutes for critical incidents
- **Service Restoration:** Sync progress resumed, data available
- **User Impact:** < 5 minute sync lag for warning incidents
- **Documentation:** Complete incident report filed
- **Prevention:** At least one preventive measure implemented

## Key Metrics to Monitor
- Sync lag (target: < 5 minutes)
- Query response time (target: < 100ms)
- Database connection pool usage (target: < 80%)
- Error rate by operation (target: < 1%)
- Memory usage (target: < 80% of limit)
- Disk usage (target: < 85% of capacity)
