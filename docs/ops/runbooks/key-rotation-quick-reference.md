# Key Rotation Quick Reference

Quick reference card for common key rotation operations. For detailed procedures, see [key-rotation.md](./key-rotation.md).

## Emergency Contacts

| Role | Contact | Method |
|------|---------|--------|
| Security Lead | security@ancore.io | PagerDuty: security-team |
| Platform Lead | platform@ancore.io | Slack: @platform-team |
| On-Call Engineer | oncall@ancore.io | PagerDuty: primary-oncall |

## Quick Commands

### Pre-Rotation Validation
```bash
# Run pre-rotation checks
./scripts/ops/key-rotation-validator.sh \
  --type relayer-signing-key \
  --phase pre-rotation

# Backup current secrets
kubectl get secret relayer-signing-key -n ancore -o yaml > /tmp/backup.yaml
```

### Relayer Signing Key (5-minute rotation)
```bash
# 1. Generate new keypair
stellar keys generate relayer-new --network mainnet
NEW_KEY=$(stellar keys address relayer-new)

# 2. Fund new account
stellar payment send --from OLD_KEY --to ${NEW_KEY} --amount 100

# 3. Update secret
kubectl create secret generic relayer-signing-key-new -n ancore \
  --from-literal=public-key=${NEW_KEY} \
  --from-literal=secret-key=${SECRET}

# 4. Update deployment
kubectl patch deployment relayer -n ancore --type='json' -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/env/0/valueFrom/secretKeyRef/name","value":"relayer-signing-key-new"}
]'

# 5. Validate
./scripts/ops/key-rotation-validator.sh \
  --type relayer-signing-key \
  --phase post-rotation
```

### API Token (Zero-downtime rotation)
```bash
# 1. Generate new token
NEW_TOKEN=$(openssl rand -hex 32)

# 2. Add to valid tokens (both old and new active)
kubectl edit configmap relayer-auth-config -n ancore

# 3. Notify clients (7-day grace period)

# 4. After 7 days, remove old token
kubectl edit configmap relayer-auth-config -n ancore
```

### Database Credentials (1-minute downtime)
```bash
# 1. Create new user
psql ${DATABASE_URL} -c "CREATE USER relayer_new WITH PASSWORD '${NEW_PASS}';"
psql ${DATABASE_URL} -c "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO relayer_new;"

# 2. Update connection string
NEW_URL="postgresql://relayer_new:${NEW_PASS}@db.ancore.io:5432/ancore"
kubectl create secret generic database-credentials-new -n ancore --from-literal=url=${NEW_URL}

# 3. Update deployment
kubectl set env deployment/relayer -n ancore --from=secret/database-credentials-new DATABASE_URL-

# 4. After 24h, revoke old user
psql ${DATABASE_URL} -c "DROP USER relayer_old;"
```

### Emergency Rollback
```bash
# Immediate rollback (< 2 minutes)
kubectl apply -f /tmp/backup.yaml
kubectl rollout undo deployment/relayer -n ancore
kubectl rollout status deployment/relayer -n ancore
```

## Validation Checklist

After any rotation:
- [ ] Service health checks passing
- [ ] Transaction success rate > 99%
- [ ] API auth success rate > 99.9%
- [ ] No error spikes in logs
- [ ] Monitoring dashboards green
- [ ] Old credentials backed up securely

## Rollback Decision Criteria

Initiate rollback immediately if:
- Transaction failure rate > 5% for 5 minutes
- Service unavailable for > 2 minutes
- Database connection errors > 10%
- API auth failure rate > 10%
- Multiple critical alerts firing

## Monitoring URLs

- Grafana: http://grafana:3000/d/relayer-overview
- Prometheus: http://prometheus:9090
- Alertmanager: http://alertmanager:9093

## Common Issues

### Issue: High auth failure rate after token rotation
**Solution:** Verify clients have migrated to new token. Check grace period hasn't expired.

### Issue: Transaction failures after signing key rotation
**Solution:** Verify new key is funded and has correct permissions. Check Stellar network connectivity.

### Issue: Database connection errors after credential rotation
**Solution:** Verify connection string format. Check user permissions. Verify password special characters are escaped.

### Issue: Service won't start after rotation
**Solution:** Check secret mounting. Verify environment variables. Review pod logs for specific errors.

## Rotation Schedule

| Key Type | Frequency | Last Rotated | Next Due |
|----------|-----------|--------------|----------|
| Relayer Signing Key | Quarterly | 2026-04-01 | 2026-07-01 |
| API Tokens | Quarterly | 2026-04-01 | 2026-07-01 |
| Database Credentials | Quarterly | 2026-04-01 | 2026-07-01 |
| Encryption Keys | Annually | 2026-01-01 | 2027-01-01 |

## Documentation Links

- [Full Runbook](./key-rotation.md)
- [Security Incident Response](../../security/INCIDENT_RESPONSE.md)
- [Cryptography Reference](../../security/CRYPTOGRAPHY.md)
- [Relayer Documentation](../../../services/relayer/README.md)
