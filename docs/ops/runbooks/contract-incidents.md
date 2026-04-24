# Runbook: Contract Incidents

## Alert
Fires when smart contracts experience critical failures, upgrade issues, or security vulnerabilities affecting account functionality and user funds.

## Severity & Escalation
- **Level:** critical (contract failure, security breach) / warning (upgrade issues, degraded performance)
- **Escalation:** PagerDuty (critical) / Slack #ancore-alerts (warning)
- **Escalation path:** On-call engineer → Contract lead → CTO (> 15 min unresolved for critical)

## Triage Flow

### 1. Immediate Assessment (0-5 minutes)
- **Check contract deployment status:**
  ```bash
  # Contract deployment logs
  kubectl logs -n ancore deploy/contract-deployer --tail=50 --since=5m
  
  # Verify contract addresses
  kubectl exec -it deploy/contract-deployer -- curl http://localhost:3000/api/v1/contracts/status
  ```
- **Verify incident scope:** Single contract vs entire system
- **Check recent contract deployments** in the last 30 minutes
- **Assess user impact:** Can users access accounts? Are funds at risk?

### 2. Quick Diagnosis (5-15 minutes)
- **Check contract call success rates** in Grafana: http://grafana:3000/d/contract-overview
- **Verify contract bytecode** matches expected deployment
- **Check for stuck transactions** interacting with contracts
- **Review validation module** functionality
- **Check upgrade mechanism** status

### 3. Deep Investigation (15+ minutes)
- **Analyze specific contract errors** and revert reasons
- **Check for potential security vulnerabilities**
- **Review contract state** for corruption or unexpected values
- **Verify upgrade logic** and migration procedures
- **Check gas consumption** patterns for anomalies

## Common Incident Types

### Contract Deployment Failed
**Symptoms:** New contract deployment failing, upgrade stuck
**Diagnosis:**
```bash
# Check deployment logs
kubectl logs -n ancore deploy/contract-deployer --tail=100 | grep -i "deploy\|error"

# Verify contract bytecode
stellar contract info [CONTRACT_ID]

# Check deployment transaction
stellar transaction info [DEPLOYMENT_TX_HASH]
```
**Remediation:**
- Check contract compilation and build process
- Verify deployment account has sufficient balance
- Check network conditions and gas fees
- Retry deployment with higher gas fees

### Contract Call Failures
**Symptoms:** Users cannot interact with contracts, revert errors
**Diagnosis:**
```bash
# Check specific contract call
stellar contract call [CONTRACT_ID] [METHOD] --args [ARGS] --dry-run

# Check contract state
stellar contract read [CONTRACT_ID] [METHOD] --args [ARGS]

# Review recent failed transactions
kubectl logs -n ancore deploy/relayer --tail=100 | grep -i "revert\|failed"
```
**Remediation:**
- Check contract bytecode integrity
- Verify validation modules are functioning
- Check for contract state corruption
- Consider emergency contract reset if needed

### Upgrade Issues
**Symptoms:** Contract upgrade stuck, migration failures
**Diagnosis:**
```bash
# Check upgrade status
kubectl exec -it deploy/contract-deployer -- curl http://localhost:3000/api/v1/upgrades/status

# Verify new contract deployment
stellar contract info [NEW_CONTRACT_ID]

# Check migration progress
kubectl logs -n ancore deploy/contract-migrator --tail=100
```
**Remediation:**
- Pause upgrade if data corruption suspected
- Roll back to previous contract version
- Fix migration logic and retry
- Implement manual data migration if needed

### Security Vulnerability
**Symptoms:** Unexpected behavior, potential exploit, unauthorized access
**Diagnosis:**
```bash
# Check for unusual transaction patterns
stellar transactions --account [CONTRACT_ID] --limit 100

# Verify contract bytecode hash
sha256sum contract.wasm

# Check contract state for anomalies
stellar contract readall [CONTRACT_ID]
```
**Remediation:**
- **IMMEDIATE:** Pause all contract interactions
- Deploy emergency patch or upgrade
- Consider contract pause mechanism if available
- Implement emergency withdrawal procedures
- Contact security team for forensic analysis

## Remediation Actions

### Immediate Actions
- **Pause contract interactions:**
  ```bash
  kubectl exec -it deploy/contract-deployer -- curl -X POST http://localhost:3000/api/v1/contracts/pause -d '{"contractId":"CONTRACT_ID"}'
  ```
- **Emergency upgrade** if critical vulnerability:
  ```bash
  kubectl exec -it deploy/contract-deployer -- curl -X POST http://localhost:3000/api/v1/contracts/emergency-upgrade -d '{"contractId":"CONTRACT_ID","newBytecode":"BASE64_WASM"}'
  ```

### Contract Management
- **Check contract status:**
  ```bash
  stellar contract info [CONTRACT_ID]
  ```
- **Verify contract bytecode integrity:**
  ```bash
  kubectl exec -it deploy/contract-deployer -- curl http://localhost:3000/api/v1/contracts/[CONTRACT_ID]/verify
  ```
- **Force contract reset** (emergency only):
  ```bash
  kubectl exec -it deploy/contract-deployer -- curl -X POST http://localhost:3000/api/v1/contracts/[CONTRACT_ID]/reset
  ```

### Upgrade Procedures
- **Pause upgrade:**
  ```bash
  kubectl exec -it deploy/contract-deployer -- curl -X POST http://localhost:3000/api/v1/upgrades/pause -d '{"upgradeId":"UPGRADE_ID"}'
  ```
- **Roll back upgrade:**
  ```bash
  kubectl exec -it deploy/contract-deployer -- curl -X POST http://localhost:3000/api/v1/upgrades/rollback -d '{"upgradeId":"UPGRADE_ID"}'
  ```

## Prevention Measures
- Implement comprehensive contract testing before deployment
- Set up automated contract verification and monitoring
- Add circuit breakers for contract failures
- Implement gradual rollout for contract upgrades
- Regularly audit contract security and functionality
- Monitor key metrics: call success rates, gas consumption, error patterns

## Security Response Protocol

### Critical Security Incidents
- **Immediate:** PagerDuty to all on-call engineers
- **5 minutes:** Create incident channel #incident-security-[timestamp]
- **10 minutes:** Notify security team and leadership
- **15 minutes:** Implement emergency response measures
- **30 minutes:** Public disclosure if user funds at risk

### Warning Security Incidents
- **Immediate:** Slack #ancore-security with details
- **1 hour:** Security team assessment
- **4 hours:** Resolution plan or escalation

## Communication Protocol

### Critical Incidents
- **Immediate:** Slack #ancore-alerts with contract failure details
- **5 minutes:** Create incident channel #incident-contract-[timestamp]
- **15 minutes:** Post status page update about contract functionality
- **30 minutes:** Send user notification if funds at risk

### Warning Incidents
- **Immediate:** Slack #ancore-alerts with performance issues
- **1 hour:** Status page update if ongoing
- **4 hours:** Resolution update or escalation

## Post-Incident Actions
- File incident report within 24 hours
- Update this runbook with new findings
- Review monitoring gaps and add alerts
- Conduct security audit if vulnerability involved
- Update contract testing procedures
- Test remediation procedures on testnet

## Success Criteria
- **Resolution Time:** < 15 minutes for critical security incidents
- **Service Restoration:** Contract functionality fully restored
- **User Impact:** No fund loss for security incidents
- **Documentation:** Complete incident report filed
- **Prevention:** Security audit completed for all incidents

## Key Metrics to Monitor
- Contract call success rate (target: >99.5%)
- Average gas consumption per call (target: within expected range)
- Contract deployment success rate (target: 100%)
- Upgrade completion time (target: < 30 minutes)
- Error rate by contract method (target: < 0.5%)
- Security alerts and false positive rate
