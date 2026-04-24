# Runbook: Relayer Incidents

## Alert
Fires when the relayer service experiences transaction failures, high latency, or service degradation affecting user transaction submissions and gas fee payments.

## Severity & Escalation
- **Level:** critical (transaction processing stopped) / warning (high failure rates)
- **Escalation:** PagerDuty (critical) / Slack #ancore-alerts (warning)
- **Escalation path:** On-call engineer → Relayer lead → CTO (> 30 min unresolved)

## Triage Flow

### 1. Immediate Assessment (0-5 minutes)
- **Check relayer service status:**
  ```bash
  # Relayer service logs
  kubectl logs -n ancore deploy/relayer --tail=50 --since=5m
  
  # Check if service is accepting transactions
  kubectl exec -it deploy/relayer -- curl http://localhost:3000/health
  ```
- **Verify incident scope:** Single transaction type vs all relaying
- **Check recent deployments** in the last 30 minutes
- **Assess user impact:** Can users submit transactions? Are gas fees being processed?

### 2. Quick Diagnosis (5-15 minutes)
- **Check transaction failure rates** in Grafana: http://grafana:3000/d/relayer-overview
- **Verify Stellar network connectivity** and node health
- **Check gas fee balance** for relayer accounts
- **Review nonce management** and transaction queue status
- **Check rate limiting** and throttling configurations

### 3. Deep Investigation (15+ minutes)
- **Analyze specific error types** in transaction failures
- **Check for stuck transactions** in the mempool
- **Review account nonce gaps** and synchronization issues
- **Check smart contract interactions** and gas estimation
- **Verify relayer account permissions** and balance

## Common Incident Types

### Transaction Submission Failed
**Symptoms:** Users cannot submit transactions, "transaction failed" errors
**Diagnosis:**
```bash
# Check Stellar node connectivity
curl -X POST https://horizon.stellar.org/transactions -d "tx=BASE64_ENCODED_TX"

# Check relayer account balance
stellar account-balances [RELAYER_ACCOUNT_ID]

# Verify gas fee settings
kubectl exec -it deploy/relayer -- cat /etc/relayer/config.json | jq '.gasSettings'
```
**Remediation:**
- Fund relayer account if balance insufficient
- Restart relayer service
- Update gas fee settings if network fees changed

### High Transaction Latency
**Symptoms:** Transactions taking >30 seconds to confirm
**Diagnosis:**
```bash
# Check Stellar network status
stellar info

# Check transaction queue
kubectl exec -it deploy/relayer -- curl http://localhost:3000/api/v1/queue/status

# Monitor network congestion
curl https://horizon.stellar.org/ledgers?order=desc&limit=1
```
**Remediation:**
- Increase gas fees for faster inclusion
- Implement transaction priority queue
- Scale up relayer instances

### Gas Estimation Errors
**Symptoms:** Incorrect gas fees, transaction failures due to insufficient gas
**Diagnosis:**
```bash
# Check gas estimation logs
kubectl logs -n ancore deploy/relayer --tail=100 | grep -i "gas"

# Test gas estimation
kubectl exec -it deploy/relayer -- curl -X POST http://localhost:3000/api/v1/estimate-gas -d '{"to":"CONTRACT_ID","data":"0x"}'
```
**Remediation:**
- Update gas estimation algorithm
- Add gas price buffer for network volatility
- Implement dynamic gas fee adjustment

### Nonce Conflicts
**Symptoms:** Transaction failures due to incorrect nonce, stuck transactions
**Diagnosis:**
```bash
# Check account nonce
kubectl exec -it deploy/relayer -- curl http://localhost:3000/api/v1/accounts/[ACCOUNT_ID]/nonce

# Review pending transactions
kubectl exec -it deploy/relayer -- curl http://localhost:3000/api/v1/pending-transactions
```
**Remediation:**
- Reset nonce synchronization
- Cancel stuck transactions
- Implement nonce gap detection

## Remediation Actions

### Immediate Actions
- **Restart relayer service:**
  ```bash
  kubectl rollout restart deploy/relayer
  ```
- **Scale up instances** if overloaded:
  ```bash
  kubectl scale deploy/relayer --replicas=5
  ```
- **Drain transaction queue** if corrupted:
  ```bash
  kubectl exec -it deploy/relayer -- curl -X DELETE http://localhost:3000/api/v1/queue/drain
  ```
- **Update gas fees** if network conditions changed

### Account Management
- **Check relayer account balance:**
  ```bash
  stellar account-balances [RELAYER_ACCOUNT_ID]
  ```
- **Fund account** if insufficient balance
- **Rotate relayer keys** if compromised

### Network Issues
- **Switch to backup Stellar node** if primary unavailable
- **Update network endpoints** if deprecated
- **Implement circuit breaker** for failed network calls

## Prevention Measures
- Implement comprehensive transaction monitoring
- Set up automated gas fee adjustment
- Add transaction queue monitoring and alerts
- Implement circuit breakers for external dependencies
- Regularly test relayer failover procedures
- Monitor key metrics: transaction success rate, average confirmation time, gas fee efficiency

## Communication Protocol

### Critical Incidents
- **Immediate:** Slack #ancore-alerts with transaction failure rates
- **5 minutes:** Create incident channel #incident-relayer-[timestamp]
- **15 minutes:** Post status page update about transaction processing
- **30 minutes:** Send user notification if widespread

### Warning Incidents
- **Immediate:** Slack #ancore-alerts with performance degradation
- **1 hour:** Status page update if ongoing
- **4 hours:** Resolution update or escalation

## Post-Incident Actions
- File incident report within 24 hours
- Update this runbook with new findings
- Review monitoring gaps and add alerts
- Conduct blameless post-mortem with relayer team
- Update gas estimation algorithms based on findings
- Test remediation procedures in staging environment

## Success Criteria
- **Resolution Time:** < 30 minutes for critical incidents
- **Service Restoration:** Transaction processing at 100% capacity
- **User Impact:** < 10% transaction failure rate for warning incidents
- **Documentation:** Complete incident report filed
- **Prevention:** At least one preventive measure implemented

## Key Metrics to Monitor
- Transaction success rate (target: >99%)
- Average transaction confirmation time (target: <30 seconds)
- Gas fee efficiency (target: within 10% of network average)
- Queue depth (target: <1000 pending transactions)
- Error rate by transaction type
