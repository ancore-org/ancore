# Operations Scripts

Automation scripts for operational tasks including key rotation, validation, and testing.

## Available Scripts

### Key Rotation Validator (`key-rotation-validator.sh`)

Validates key rotation procedures and performs automated checks to ensure rotation was successful and services are healthy.

**Usage:**

```bash
./key-rotation-validator.sh --type <rotation-type> --phase <phase>
```

**Rotation Types:**

- `relayer-signing-key` - Relayer Ed25519 signing keypair
- `api-token` - API authentication tokens
- `database-credentials` - PostgreSQL credentials
- `stellar-rpc` - Stellar RPC API credentials
- `encryption-key` - AES-256-GCM encryption keys

**Phases:**

- `pre-rotation` - Pre-flight checks before rotation
- `post-rotation` - Validation after rotation complete
- `rollback-check` - Verify rollback capability

**Examples:**

```bash
# Pre-rotation checks for signing key
./key-rotation-validator.sh --type relayer-signing-key --phase pre-rotation

# Post-rotation validation for API token
./key-rotation-validator.sh --type api-token --phase post-rotation

# Rollback verification in dry-run mode
./key-rotation-validator.sh --type database-credentials --phase rollback-check --dry-run
```

**Environment Variables:**

- `NAMESPACE` - Kubernetes namespace (default: ancore)
- `GRAFANA_URL` - Grafana dashboard URL for metrics
- `ALERT_WEBHOOK` - Slack webhook for notifications
- `DRY_RUN` - Set to 'true' for dry-run mode

---

### Key Rotation Test Suite (`test-key-rotation.sh`)

Tests key rotation procedures in a safe staging environment.

**Usage:**

```bash
./test-key-rotation.sh [rotation-type]
```

**Test Types:**

- `all` - Run all rotation tests (default)
- `relayer-signing-key` - Test relayer signing key rotation
- `api-token` - Test API token rotation
- `database-credentials` - Test database credential rotation
- `validation-script` - Test the validation script itself
- `runbook` - Test runbook completeness

**Examples:**

```bash
# Run all tests
./test-key-rotation.sh all

# Test specific rotation type
./test-key-rotation.sh relayer-signing-key

# Test in custom namespace
TEST_NAMESPACE=ancore-dev ./test-key-rotation.sh all

# Skip cleanup after tests
SKIP_CLEANUP=true ./test-key-rotation.sh all
```

**Environment Variables:**

- `TEST_NAMESPACE` - Kubernetes namespace for testing (default: ancore-staging)
- `SKIP_CLEANUP` - Set to 'true' to skip cleanup after tests

---

## Integration with CI/CD

### Pre-Deployment Validation

Add to your CI pipeline before deploying key rotation changes:

```yaml
# .github/workflows/validate-key-rotation.yml
name: Validate Key Rotation

on:
  pull_request:
    paths:
      - 'docs/ops/runbooks/key-rotation.md'
      - 'scripts/ops/key-rotation-*.sh'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run key rotation tests
        run: |
          ./scripts/ops/test-key-rotation.sh all
        env:
          TEST_NAMESPACE: ancore-ci
```

### Scheduled Rotation Drills

Schedule regular rotation drills to ensure procedures remain current:

```yaml
# .github/workflows/rotation-drill.yml
name: Monthly Rotation Drill

on:
  schedule:
    - cron: '0 10 1 * *' # First day of month at 10:00 UTC

jobs:
  drill:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run rotation drill
        run: |
          ./scripts/ops/test-key-rotation.sh all
        env:
          TEST_NAMESPACE: ancore-drill
```

---

## Monitoring Integration

### Prometheus Metrics

The validation script can export metrics for monitoring:

```bash
# Export validation results to Prometheus pushgateway
./key-rotation-validator.sh --type relayer-signing-key --phase post-rotation | \
  ./scripts/ops/export-metrics.sh
```

### Alerting

Alert rules for key rotation are defined in:

- `docs/ops/alerts/key-rotation.yml`

Load alerts into Prometheus:

```bash
promtool check rules docs/ops/alerts/key-rotation.yml
kubectl apply -f docs/ops/alerts/key-rotation.yml
```

---

## Troubleshooting

### Common Issues

**Issue: "Cannot access Kubernetes namespace"**

```bash
# Verify kubectl configuration
kubectl config current-context
kubectl get namespace ancore

# Set correct context
kubectl config use-context <your-context>
```

**Issue: "Missing required tools"**

```bash
# Install required tools
brew install kubectl jq curl  # macOS
apt-get install kubectl jq curl  # Ubuntu/Debian
```

**Issue: "Validation script fails with permission denied"**

```bash
# Make script executable
chmod +x scripts/ops/key-rotation-validator.sh
```

**Issue: "Test namespace already exists with resources"**

```bash
# Clean up test namespace
kubectl delete namespace ancore-staging
# Or force cleanup
SKIP_CLEANUP=false ./test-key-rotation.sh all
```

---

## Development

### Adding New Validation Checks

To add a new validation check to `key-rotation-validator.sh`:

1. Add a new function following the naming pattern:

```bash
validate_new_check() {
  log "Validating new check..."

  # Your validation logic here

  if [[ condition ]]; then
    success "New check passed"
  else
    error "New check failed"
    return 1
  fi
}
```

2. Call the function in the appropriate validation phase:

```bash
post_rotation_validation() {
  # ... existing checks ...
  validate_new_check
}
```

3. Add corresponding test case to `test-key-rotation.sh`

### Adding New Test Cases

To add a new test case to `test-key-rotation.sh`:

1. Create a new test function:

```bash
test_new_feature() {
  section "Testing New Feature"

  log "Test 1: Description"
  if [[ test_condition ]]; then
    success "Test passed"
  else
    fail "Test failed"
  fi
}
```

2. Add to the main test suite:

```bash
main() {
  # ... existing tests ...
  test_new_feature
}
```

---

## Security Considerations

### Sensitive Data Handling

- Never log or display actual credentials
- Use placeholders in dry-run mode
- Secure backup files with appropriate permissions (600)
- Clean up temporary files containing secrets

### Access Control

- Limit script execution to authorized operators
- Use RBAC to control Kubernetes access
- Audit script execution in production
- Require approval for production rotations

### Compliance

- Maintain audit trail of all rotations
- Document rotation decisions and outcomes
- Retain rotation reports for compliance
- Follow organizational security policies

---

## Related Documentation

- [Key Rotation Runbook](../../docs/ops/runbooks/key-rotation.md)
- [Key Rotation Quick Reference](../../docs/ops/runbooks/key-rotation-quick-reference.md)
- [Security Incident Response](../../docs/security/INCIDENT_RESPONSE.md)
- [Cryptography Reference](../../docs/security/CRYPTOGRAPHY.md)

---

## Support

For issues or questions:

- **Security concerns:** security@ancore.io
- **Operational issues:** ops@ancore.io
- **On-call support:** PagerDuty primary-oncall

---

## License

Apache-2.0 OR MIT
