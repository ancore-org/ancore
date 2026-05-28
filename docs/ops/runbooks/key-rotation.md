# Runbook: Key Rotation for Relayer/Secrets and API Credentials

## Overview
This runbook provides step-by-step procedures for rotating cryptographic keys, API credentials, and secrets used by the Ancore relayer service and related infrastructure. Key rotation is a critical security practice that limits the impact of potential key compromise and ensures operational continuity.

## Scope
This runbook covers rotation of:
- **Relayer signing keys** (Ed25519 keypairs for transaction submission)
- **API authentication tokens** (Bearer tokens for relayer API access)
- **Database credentials** (PostgreSQL connection strings)
- **Stellar network credentials** (Horizon/Soroban RPC access keys)
- **Service-to-service secrets** (inter-service authentication)
- **Encryption keys** (AES-256-GCM keys for at-rest encryption)

## Severity & Scheduling

### Planned Rotation (Routine)
- **Frequency:** Quarterly for production keys, monthly for staging
- **Scheduling:** During maintenance windows (low-traffic periods)
- **Notification:** 48-hour advance notice to stakeholders
- **Approval:** Engineering lead + Security lead sign-off required

### Emergency Rotation (Compromise Response)
- **Trigger:** Suspected or confirmed key compromise, security incident
- **Severity:** Critical (Sev-1)
- **Response Time:** Initiate within 30 minutes of confirmation
- **Escalation:** Security lead → CTO → Legal (if user funds at risk)

## Prerequisites

### Required Access
- [ ] Production Kubernetes cluster access (`kubectl` configured)
- [ ] Secrets management system access (environment-specific)
- [ ] Database admin credentials (for credential rotation)
- [ ] Stellar account admin access (for relayer account management)
- [ ] PagerDuty/incident management access

### Required Tools
```bash
# Verify tool availability
command -v kubectl || echo "Install kubectl"
command -v stellar || echo "Install stellar-cli"
command -v psql || echo "Install PostgreSQL client"
command -v openssl || echo "Install OpenSSL"
```

### Pre-Rotation Checklist
- [ ] Backup current secrets to secure offline storage
- [ ] Document current key identifiers and creation dates
- [ ] Verify rollback procedures are tested and ready
- [ ] Ensure monitoring and alerting are active
- [ ] Create incident channel: `#rotation-[service]-[timestamp]`
- [ ] Notify on-call team and stakeholders

## Rotation Procedures

---

## 1. Relayer Signing Key Rotation

### Context
The relayer service uses Ed25519 keypairs to sign and submit transactions to the Stellar network on behalf of users. Rotating these keys requires updating both the Stellar account configuration and the relayer service secrets.

### Impact Assessment
- **Downtime:** 2-5 minutes (during key switchover)
- **User Impact:** Transaction submissions temporarily paused
- **Rollback Time:** < 2 minutes

### Procedure

#### Step 1: Generate New Keypair (0-5 minutes)
```bash
# Generate new Ed25519 keypair
stellar keys generate relayer-new --network testnet

# Capture the new public key
NEW_PUBLIC_KEY=$(stellar keys address relayer-new)
echo "New public key: ${NEW_PUBLIC_KEY}"

# Export secret key to secure location (encrypted)
stellar keys show relayer-new --secret > /tmp/relayer-new-secret.txt
chmod 600 /tmp/relayer-new-secret.txt

# Verify keypair
stellar keys list | grep relayer-new
```

#### Step 2: Fund New Account (5-10 minutes)
```bash
# Get current relayer balance
CURRENT_KEY=$(kubectl get secret relayer-signing-key -n ancore -o jsonpath='{.data.public-key}' | base64 -d)
CURRENT_BALANCE=$(stellar account balance ${CURRENT_KEY} --network mainnet)

echo "Current balance: ${CURRENT_BALANCE} XLM"

# Fund new account with sufficient balance for operations
# Minimum: 10 XLM base reserve + operational buffer (100 XLM recommended)
stellar payment send \
  --from ${CURRENT_KEY} \
  --to ${NEW_PUBLIC_KEY} \
  --amount 100 \
  --network mainnet

# Verify new account funded
stellar account balance ${NEW_PUBLIC_KEY} --network mainnet
```

#### Step 3: Update Kubernetes Secret (10-15 minutes)
```bash
# Backup current secret
kubectl get secret relayer-signing-key -n ancore -o yaml > /tmp/relayer-signing-key-backup.yaml

# Read new secret key
NEW_SECRET_KEY=$(cat /tmp/relayer-new-secret.txt)

# Create new secret (base64 encoded)
kubectl create secret generic relayer-signing-key-new -n ancore \
  --from-literal=public-key=${NEW_PUBLIC_KEY} \
  --from-literal=secret-key=${NEW_SECRET_KEY} \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret created
kubectl get secret relayer-signing-key-new -n ancore
```

#### Step 4: Update Relayer Deployment (15-20 minutes)
```bash
# Update deployment to use new secret
kubectl patch deployment relayer -n ancore --type='json' -p='[
  {
    "op": "replace",
    "path": "/spec/template/spec/containers/0/env/0/valueFrom/secretKeyRef/name",
    "value": "relayer-signing-key-new"
  }
]'

# Monitor rollout
kubectl rollout status deployment/relayer -n ancore --timeout=5m

# Verify new pods are using new key
kubectl logs -n ancore deployment/relayer --tail=20 | grep -i "signing key"
```

#### Step 5: Validation (20-25 minutes)
```bash
# Test transaction submission with new key
curl -X POST https://relayer.ancore.io/relay/execute \
  -H "Authorization: Bearer ${TEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionKey": "'"${TEST_SESSION_KEY}"'",
    "operation": "relay_execute",
    "parameters": {},
    "signature": "'"${TEST_SIGNATURE}"'",
    "nonce": 1
  }'

# Expected: 200 OK with transactionId

# Check transaction success rate
kubectl exec -n ancore deployment/relayer -- curl http://localhost:3000/relay/status

# Monitor error rates in Grafana
# http://grafana:3000/d/relayer-overview
```

#### Step 6: Cleanup Old Key (25-30 minutes)
```bash
# Wait 24 hours before cleanup to ensure no rollback needed
# After 24 hours:

# Remove old secret
kubectl delete secret relayer-signing-key -n ancore

# Rename new secret to canonical name
kubectl get secret relayer-signing-key-new -n ancore -o yaml | \
  sed 's/relayer-signing-key-new/relayer-signing-key/' | \
  kubectl apply -f -

kubectl delete secret relayer-signing-key-new -n ancore

# Securely delete old keypair from local storage
shred -u /tmp/relayer-new-secret.txt
rm -f /tmp/relayer-signing-key-backup.yaml
```

### Rollback Procedure
```bash
# If issues detected, rollback to old key immediately

# Restore old secret
kubectl apply -f /tmp/relayer-signing-key-backup.yaml

# Rollback deployment
kubectl rollout undo deployment/relayer -n ancore

# Verify rollback
kubectl rollout status deployment/relayer -n ancore
kubectl logs -n ancore deployment/relayer --tail=20
```

---

## 2. API Authentication Token Rotation

### Context
Bearer tokens authenticate clients accessing the relayer API. Tokens should be rotated regularly and immediately upon suspected compromise.

### Impact Assessment
- **Downtime:** None (gradual migration supported)
- **User Impact:** Clients must update tokens within grace period
- **Grace Period:** 7 days (both old and new tokens valid)

### Procedure

#### Step 1: Generate New Token (0-2 minutes)
```bash
# Generate cryptographically secure token
NEW_TOKEN=$(openssl rand -hex 32)
echo "New token: ${NEW_TOKEN}"

# Store in secrets management system
kubectl create secret generic relayer-api-token-new -n ancore \
  --from-literal=token=${NEW_TOKEN}
```

#### Step 2: Update Token Validation (2-5 minutes)
```bash
# Update auth service to accept both old and new tokens
# Edit auth service configuration to include both tokens

kubectl edit configmap relayer-auth-config -n ancore

# Add new token to valid_tokens list:
# valid_tokens:
#   - <old_token>
#   - <new_token>

# Restart auth service to pick up new config
kubectl rollout restart deployment/relayer-auth -n ancore
```

#### Step 3: Notify Clients (5-10 minutes)
```bash
# Send notification to all API clients
# Include:
# - New token value
# - Effective date
# - Old token deprecation date (7 days)
# - Migration instructions

# Template notification:
cat <<EOF
Subject: Ancore Relayer API Token Rotation

Action Required: Update your API authentication token

New Token: ${NEW_TOKEN}
Effective: Immediately
Old Token Valid Until: $(date -d '+7 days' '+%Y-%m-%d')

Update your Authorization header:
Authorization: Bearer ${NEW_TOKEN}

Contact: ops@ancore.io for assistance
EOF
```

#### Step 4: Monitor Migration (Ongoing)
```bash
# Track token usage over grace period
kubectl logs -n ancore deployment/relayer-auth | grep "token_used" | \
  jq -r '.token_id' | sort | uniq -c

# After 7 days, verify all clients migrated
```

#### Step 5: Revoke Old Token (After 7 days)
```bash
# Remove old token from valid list
kubectl edit configmap relayer-auth-config -n ancore

# Remove old token from valid_tokens list

# Restart auth service
kubectl rollout restart deployment/relayer-auth -n ancore

# Verify old token rejected
curl -X POST https://relayer.ancore.io/relay/status \
  -H "Authorization: Bearer ${OLD_TOKEN}"

# Expected: 401 Unauthorized
```

---

## 3. Database Credential Rotation

### Context
PostgreSQL credentials used by indexer and relayer services for data persistence.

### Impact Assessment
- **Downtime:** < 1 minute (connection pool refresh)
- **User Impact:** Brief query latency spike
- **Rollback Time:** < 1 minute

### Procedure

#### Step 1: Create New Database User (0-5 minutes)
```bash
# Connect to database as admin
psql ${DATABASE_URL} <<EOF
-- Create new user with same permissions
CREATE USER relayer_new WITH PASSWORD '$(openssl rand -base64 32)';

-- Grant same permissions as old user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO relayer_new;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO relayer_new;

-- Verify permissions
\du relayer_new
EOF
```

#### Step 2: Update Connection String (5-10 minutes)
```bash
# Construct new connection string
NEW_DB_URL="postgresql://relayer_new:${NEW_PASSWORD}@db.ancore.io:5432/ancore"

# Update Kubernetes secret
kubectl create secret generic database-credentials-new -n ancore \
  --from-literal=url=${NEW_DB_URL}

# Update deployment
kubectl set env deployment/relayer -n ancore \
  --from=secret/database-credentials-new \
  DATABASE_URL-

# Monitor rollout
kubectl rollout status deployment/relayer -n ancore
```

#### Step 3: Validation (10-15 minutes)
```bash
# Verify database connectivity
kubectl exec -n ancore deployment/relayer -- \
  psql ${NEW_DB_URL} -c "SELECT 1;"

# Check application logs for database errors
kubectl logs -n ancore deployment/relayer --tail=50 | grep -i "database"

# Monitor query performance
# Check for connection pool errors or slow queries
```

#### Step 4: Revoke Old Credentials (After 24 hours)
```bash
# After confirming stability, revoke old user
psql ${DATABASE_URL} <<EOF
-- Terminate existing connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE usename = 'relayer_old';

-- Revoke permissions and drop user
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM relayer_old;
DROP USER relayer_old;
EOF
```

---

## 4. Stellar Network Credentials Rotation

### Context
Horizon/Soroban RPC API keys for blockchain interaction.

### Impact Assessment
- **Downtime:** None (if using multiple endpoints)
- **User Impact:** None (transparent failover)
- **Rollback Time:** Immediate

### Procedure

#### Step 1: Generate New API Key (0-2 minutes)
```bash
# Request new API key from Stellar provider
# (Process varies by provider - Infura, Alchemy, etc.)

# For self-hosted nodes, generate new auth token
NEW_RPC_TOKEN=$(openssl rand -hex 32)
```

#### Step 2: Add New Endpoint (2-5 minutes)
```bash
# Update relayer config to include new endpoint
kubectl edit configmap relayer-config -n ancore

# Add new RPC endpoint to list:
# stellar_rpc_endpoints:
#   - url: https://soroban-rpc.stellar.org
#     token: <old_token>
#     weight: 50
#   - url: https://soroban-rpc.stellar.org
#     token: <new_token>
#     weight: 50

# Restart relayer to pick up new config
kubectl rollout restart deployment/relayer -n ancore
```

#### Step 3: Monitor Traffic Distribution (5-15 minutes)
```bash
# Verify traffic split between endpoints
kubectl logs -n ancore deployment/relayer | grep "rpc_endpoint" | \
  jq -r '.endpoint' | sort | uniq -c

# Check error rates per endpoint
# Ensure new endpoint is healthy
```

#### Step 4: Migrate to New Endpoint (15-20 minutes)
```bash
# Shift all traffic to new endpoint
kubectl edit configmap relayer-config -n ancore

# Update weights:
# stellar_rpc_endpoints:
#   - url: https://soroban-rpc.stellar.org
#     token: <old_token>
#     weight: 0
#   - url: https://soroban-rpc.stellar.org
#     token: <new_token>
#     weight: 100

# Restart relayer
kubectl rollout restart deployment/relayer -n ancore
```

#### Step 5: Remove Old Endpoint (After 24 hours)
```bash
# Remove old endpoint from config
kubectl edit configmap relayer-config -n ancore

# Remove old endpoint entry entirely

# Revoke old API key with provider
```

---

## 5. Encryption Key Rotation (AES-256-GCM)

### Context
Master encryption keys used for at-rest encryption of sensitive data (wallet secrets, session keys).

### Impact Assessment
- **Downtime:** None (re-encryption performed asynchronously)
- **User Impact:** None (transparent to users)
- **Duration:** Hours to days (depending on data volume)

### Procedure

#### Step 1: Generate New Master Key (0-2 minutes)
```bash
# Generate new AES-256 key
NEW_MASTER_KEY=$(openssl rand -hex 32)

# Store in secrets management
kubectl create secret generic encryption-master-key-v2 -n ancore \
  --from-literal=key=${NEW_MASTER_KEY} \
  --from-literal=version=2
```

#### Step 2: Deploy Re-encryption Worker (2-10 minutes)
```bash
# Deploy background worker to re-encrypt data
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: reencrypt-secrets-v2
  namespace: ancore
spec:
  template:
    spec:
      containers:
      - name: reencrypt
        image: ancore/crypto-tools:latest
        env:
        - name: OLD_KEY
          valueFrom:
            secretKeyRef:
              name: encryption-master-key-v1
              key: key
        - name: NEW_KEY
          valueFrom:
            secretKeyRef:
              name: encryption-master-key-v2
              key: key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        command:
        - /usr/local/bin/reencrypt-worker
        - --batch-size=100
        - --old-version=1
        - --new-version=2
      restartPolicy: OnFailure
  backoffLimit: 3
EOF
```

#### Step 3: Monitor Re-encryption Progress (Ongoing)
```bash
# Check job progress
kubectl logs -n ancore job/reencrypt-secrets-v2 --follow

# Query re-encryption status
psql ${DATABASE_URL} -c "
SELECT 
  encryption_version,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM encrypted_secrets
GROUP BY encryption_version;
"

# Expected output:
# encryption_version | count | percentage
# -------------------+-------+------------
#                  1 |   500 |      25.00
#                  2 |  1500 |      75.00
```

#### Step 4: Update Application to Use New Key (After 100% re-encrypted)
```bash
# Verify all data re-encrypted
REMAINING=$(psql ${DATABASE_URL} -t -c "
SELECT COUNT(*) FROM encrypted_secrets WHERE encryption_version = 1;
")

if [ "${REMAINING}" -eq 0 ]; then
  echo "Re-encryption complete"
  
  # Update application to use new key as primary
  kubectl set env deployment/relayer -n ancore \
    ENCRYPTION_KEY_VERSION=2
  
  # Restart services
  kubectl rollout restart deployment/relayer -n ancore
else
  echo "Re-encryption incomplete: ${REMAINING} records remaining"
fi
```

#### Step 5: Retire Old Key (After 30 days)
```bash
# After 30-day retention period, delete old key
kubectl delete secret encryption-master-key-v1 -n ancore

# Remove old key version from code
# Update minimum supported version in application config
```

---

## Emergency Rotation (Compromise Response)

### Immediate Actions (0-15 minutes)

#### 1. Assess Scope
```bash
# Determine which keys are compromised
# Check logs for unauthorized access
kubectl logs -n ancore deployment/relayer --since=24h | grep -i "unauthorized\|failed\|error"

# Review recent API calls
kubectl logs -n ancore deployment/relayer-auth --since=24h | grep "401\|403"

# Check for unusual transaction patterns
psql ${DATABASE_URL} -c "
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as tx_count,
  COUNT(DISTINCT account_id) as unique_accounts
FROM account_activity
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
"
```

#### 2. Contain Breach
```bash
# Immediately disable compromised credentials
# For API tokens:
kubectl edit configmap relayer-auth-config -n ancore
# Remove compromised token from valid_tokens list

# For signing keys:
# Pause relayer service
kubectl scale deployment/relayer -n ancore --replicas=0

# For database credentials:
# Revoke access immediately
psql ${DATABASE_URL} -c "
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = 'compromised_user';
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM compromised_user;
"
```

#### 3. Notify Stakeholders
```bash
# Create incident channel
# Post to #incident-security-[timestamp]

# Notify security team
# Send PagerDuty alert

# Template message:
cat <<EOF
SECURITY INCIDENT: Key Compromise Detected

Severity: Critical (Sev-1)
Affected: [List compromised credentials]
Status: Contained
Action: Emergency rotation in progress

Timeline:
- Detection: $(date)
- Containment: $(date)
- Rotation ETA: 30 minutes

Incident Commander: [Name]
Security Lead: [Name]
EOF
```

#### 4. Execute Emergency Rotation
```bash
# Follow standard rotation procedures with expedited timeline
# Skip grace periods and notification delays
# Rotate all potentially affected credentials

# Priority order:
# 1. Signing keys (highest risk)
# 2. API tokens
# 3. Database credentials
# 4. Encryption keys (if at-rest data accessed)
```

#### 5. Validate Security Posture
```bash
# Verify no unauthorized access after rotation
kubectl logs -n ancore deployment/relayer --since=30m | grep -i "unauthorized"

# Check for suspicious transactions
# Review all transactions in compromise window

# Audit all access logs
# Identify any data exfiltration
```

---

## Validation Checklist

After any key rotation, verify:

### Functional Validation
- [ ] Service health checks passing
- [ ] Transaction submission successful
- [ ] API authentication working
- [ ] Database queries executing
- [ ] No error spikes in logs
- [ ] Monitoring dashboards green

### Security Validation
- [ ] Old credentials revoked (after grace period)
- [ ] New credentials stored securely
- [ ] Access logs show only new credentials in use
- [ ] No unauthorized access attempts
- [ ] Audit trail complete and accurate

### Operational Validation
- [ ] Documentation updated with new key metadata
- [ ] Backup of old credentials secured offline
- [ ] Rollback procedure tested and ready
- [ ] Team notified of rotation completion
- [ ] Post-rotation report filed

---

## Rollback Procedures

### General Rollback Steps
```bash
# 1. Restore old secret from backup
kubectl apply -f /tmp/[service]-secret-backup.yaml

# 2. Rollback deployment
kubectl rollout undo deployment/[service] -n ancore

# 3. Verify rollback successful
kubectl rollout status deployment/[service] -n ancore
kubectl logs -n ancore deployment/[service] --tail=50

# 4. Test functionality
curl -X GET https://[service].ancore.io/health

# 5. Monitor for stability
# Check Grafana dashboards for 15 minutes
```

### Rollback Decision Criteria
Initiate rollback if:
- Transaction failure rate > 5% for 5 minutes
- Service unavailable for > 2 minutes
- Database connection errors > 10% of queries
- API authentication failure rate > 10%
- Any security alert triggered during rotation

---

## Monitoring and Alerts

### Key Metrics to Monitor During Rotation
- Transaction success rate (target: > 99%)
- API authentication success rate (target: > 99.9%)
- Database connection pool health
- Service response time (p50, p95, p99)
- Error rate by error type
- Active connection count

### Alert Thresholds
```yaml
# Add to docs/ops/alerts/key-rotation.yml
groups:
  - name: key_rotation
    interval: 30s
    rules:
      - alert: HighAuthFailureRateDuringRotation
        expr: rate(auth_failures_total[5m]) > 0.1
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate during key rotation"
          runbook_url: "https://github.com/ancore/ancore/blob/main/docs/ops/runbooks/key-rotation.md"
      
      - alert: TransactionFailureSpikeDuringRotation
        expr: rate(transaction_failures_total[5m]) > 0.05
        labels:
          severity: critical
        annotations:
          summary: "Transaction failure spike during key rotation"
          runbook_url: "https://github.com/ancore/ancore/blob/main/docs/ops/runbooks/key-rotation.md"
```

---

## Post-Rotation Actions

### Immediate (Within 1 hour)
- [ ] Update incident channel with completion status
- [ ] Verify all validation checks passed
- [ ] Document any issues encountered
- [ ] Update key inventory with new key metadata

### Short-term (Within 24 hours)
- [ ] File rotation report with timeline and metrics
- [ ] Review logs for any anomalies
- [ ] Update runbook with lessons learned
- [ ] Schedule old credential cleanup (if not immediate)

### Long-term (Within 1 week)
- [ ] Conduct post-rotation review meeting
- [ ] Update key rotation schedule
- [ ] Improve automation based on findings
- [ ] Update disaster recovery documentation

---

## Automation Opportunities

### Recommended Automation
1. **Automated key generation** with secure random sources
2. **Secret backup** to encrypted offline storage
3. **Validation testing** with synthetic transactions
4. **Monitoring dashboard** specific to rotation events
5. **Rollback triggers** based on error thresholds
6. **Notification system** for stakeholder updates

### Future Enhancements
- Implement zero-downtime rotation with key versioning
- Add automated re-encryption for encryption key rotation
- Build self-service rotation UI for authorized operators
- Integrate with HashiCorp Vault or AWS Secrets Manager
- Implement automatic rotation on schedule

---

## Key Inventory and Metadata

Maintain a secure inventory of all keys:

| Key Type | Current Version | Created Date | Last Rotated | Next Rotation | Owner |
|----------|----------------|--------------|--------------|---------------|-------|
| Relayer Signing Key | v3 | 2026-01-15 | 2026-04-01 | 2026-07-01 | Platform Team |
| API Token (Production) | v2 | 2026-02-01 | 2026-04-01 | 2026-07-01 | Security Team |
| Database Credentials | v4 | 2026-03-01 | 2026-04-01 | 2026-07-01 | Database Team |
| Encryption Master Key | v2 | 2026-01-01 | 2026-04-01 | 2026-07-01 | Security Team |

---

## References

- [Security Incident Response Plan](../security/INCIDENT_RESPONSE.md)
- [Cryptography Reference](../security/CRYPTOGRAPHY.md)
- [Relayer Service Documentation](../../services/relayer/README.md)
- [Stellar Key Management Best Practices](https://developers.stellar.org/docs/learn/encyclopedia/security/key-management)

---

## Contact Information

| Role | Contact | Escalation |
|------|---------|------------|
| **Security Lead** | security@ancore.io | PagerDuty: security-team |
| **Platform Lead** | platform@ancore.io | Slack: @platform-team |
| **On-Call Engineer** | oncall@ancore.io | PagerDuty: primary-oncall |
| **Database Admin** | dba@ancore.io | Slack: @database-team |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-27 | Security Team | Initial runbook creation |

