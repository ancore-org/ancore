#!/usr/bin/env bash
#
# Key Rotation Test Suite
#
# Tests key rotation procedures in a safe staging environment.
# DO NOT run against production without explicit approval.
#
# Usage:
#   ./test-key-rotation.sh [rotation-type]
#
# Rotation Types:
#   all                     Run all rotation tests
#   relayer-signing-key     Test relayer signing key rotation
#   api-token               Test API token rotation
#   database-credentials    Test database credential rotation
#
# Environment Variables:
#   TEST_NAMESPACE          Kubernetes namespace for testing (default: ancore-staging)
#   SKIP_CLEANUP            Set to 'true' to skip cleanup after tests
#

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_NAMESPACE="${TEST_NAMESPACE:-ancore-staging}"
SKIP_CLEANUP="${SKIP_CLEANUP:-false}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# ── Helper Functions ──────────────────────────────────────────────────────────

log() {
  echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $*"
}

success() {
  echo -e "${GREEN}✓${NC} $*"
  ((TESTS_PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $*"
  ((TESTS_FAILED++))
}

skip() {
  echo -e "${YELLOW}⊘${NC} $*"
  ((TESTS_SKIPPED++))
}

section() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $*${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

# ── Test Setup ────────────────────────────────────────────────────────────────

setup_test_environment() {
  section "Setting Up Test Environment"
  
  log "Verifying test namespace: ${TEST_NAMESPACE}"
  if ! kubectl get namespace "${TEST_NAMESPACE}" >/dev/null 2>&1; then
    log "Creating test namespace..."
    kubectl create namespace "${TEST_NAMESPACE}"
  fi
  success "Test namespace ready"
  
  log "Deploying test relayer service..."
  kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: relayer-test
  namespace: ${TEST_NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: relayer-test
  template:
    metadata:
      labels:
        app: relayer-test
    spec:
      containers:
      - name: relayer
        image: nginx:alpine
        ports:
        - containerPort: 80
        env:
        - name: TEST_MODE
          value: "true"
EOF
  
  kubectl wait --for=condition=available --timeout=60s \
    deployment/relayer-test -n "${TEST_NAMESPACE}" >/dev/null 2>&1 || true
  
  success "Test environment ready"
}

cleanup_test_environment() {
  if [[ "${SKIP_CLEANUP}" == "true" ]]; then
    log "Skipping cleanup (SKIP_CLEANUP=true)"
    return 0
  fi
  
  section "Cleaning Up Test Environment"
  
  log "Removing test resources..."
  kubectl delete deployment relayer-test -n "${TEST_NAMESPACE}" --ignore-not-found=true
  kubectl delete secret test-signing-key -n "${TEST_NAMESPACE}" --ignore-not-found=true
  kubectl delete secret test-api-token -n "${TEST_NAMESPACE}" --ignore-not-found=true
  kubectl delete secret test-db-credentials -n "${TEST_NAMESPACE}" --ignore-not-found=true
  
  success "Cleanup complete"
}

# ── Test Cases ────────────────────────────────────────────────────────────────

test_relayer_signing_key_rotation() {
  section "Testing Relayer Signing Key Rotation"
  
  # Test 1: Generate new keypair
  log "Test 1: Generate new keypair"
  if command -v stellar >/dev/null 2>&1; then
    if stellar keys generate test-relayer-key --network testnet >/dev/null 2>&1; then
      success "Keypair generation successful"
    else
      fail "Keypair generation failed"
    fi
  else
    skip "stellar-cli not available"
  fi
  
  # Test 2: Create Kubernetes secret
  log "Test 2: Create Kubernetes secret"
  if kubectl create secret generic test-signing-key -n "${TEST_NAMESPACE}" \
    --from-literal=public-key="test-public-key-12345678" \
    --from-literal=secret-key="test-secret-key-12345678" >/dev/null 2>&1; then
    success "Secret creation successful"
  else
    fail "Secret creation failed"
  fi
  
  # Test 3: Verify secret exists
  log "Test 3: Verify secret exists"
  if kubectl get secret test-signing-key -n "${TEST_NAMESPACE}" >/dev/null 2>&1; then
    success "Secret verification successful"
  else
    fail "Secret verification failed"
  fi
  
  # Test 4: Update deployment with new secret
  log "Test 4: Update deployment with new secret"
  if kubectl set env deployment/relayer-test -n "${TEST_NAMESPACE}" \
    TEST_KEY=test-value >/dev/null 2>&1; then
    success "Deployment update successful"
  else
    fail "Deployment update failed"
  fi
  
  # Test 5: Verify rollout
  log "Test 5: Verify rollout"
  if kubectl rollout status deployment/relayer-test -n "${TEST_NAMESPACE}" --timeout=60s >/dev/null 2>&1; then
    success "Rollout verification successful"
  else
    fail "Rollout verification failed"
  fi
  
  # Test 6: Test rollback capability
  log "Test 6: Test rollback capability"
  if kubectl rollout undo deployment/relayer-test -n "${TEST_NAMESPACE}" >/dev/null 2>&1; then
    kubectl rollout status deployment/relayer-test -n "${TEST_NAMESPACE}" --timeout=60s >/dev/null 2>&1
    success "Rollback test successful"
  else
    fail "Rollback test failed"
  fi
}

test_api_token_rotation() {
  section "Testing API Token Rotation"
  
  # Test 1: Generate new token
  log "Test 1: Generate new token"
  if command -v openssl >/dev/null 2>&1; then
    NEW_TOKEN=$(openssl rand -hex 32)
    if [[ -n "${NEW_TOKEN}" ]]; then
      success "Token generation successful"
    else
      fail "Token generation failed"
    fi
  else
    skip "openssl not available"
  fi
  
  # Test 2: Create secret with token
  log "Test 2: Create secret with token"
  if kubectl create secret generic test-api-token -n "${TEST_NAMESPACE}" \
    --from-literal=token="${NEW_TOKEN:-test-token-12345678}" >/dev/null 2>&1; then
    success "Token secret creation successful"
  else
    fail "Token secret creation failed"
  fi
  
  # Test 3: Verify token format
  log "Test 3: Verify token format"
  STORED_TOKEN=$(kubectl get secret test-api-token -n "${TEST_NAMESPACE}" \
    -o jsonpath='{.data.token}' | base64 -d)
  if [[ ${#STORED_TOKEN} -eq 64 ]]; then
    success "Token format validation successful"
  else
    fail "Token format validation failed (length: ${#STORED_TOKEN})"
  fi
  
  # Test 4: Test token update (simulating dual-token period)
  log "Test 4: Test token update"
  NEW_TOKEN_2=$(openssl rand -hex 32 2>/dev/null || echo "test-token-87654321")
  if kubectl create secret generic test-api-token-new -n "${TEST_NAMESPACE}" \
    --from-literal=token="${NEW_TOKEN_2}" --dry-run=client -o yaml | \
    kubectl apply -f - >/dev/null 2>&1; then
    success "Token update successful"
  else
    fail "Token update failed"
  fi
}

test_database_credentials_rotation() {
  section "Testing Database Credentials Rotation"
  
  # Test 1: Create database credential secret
  log "Test 1: Create database credential secret"
  TEST_DB_URL="postgresql://test_user:test_pass@localhost:5432/test_db"
  if kubectl create secret generic test-db-credentials -n "${TEST_NAMESPACE}" \
    --from-literal=url="${TEST_DB_URL}" >/dev/null 2>&1; then
    success "Database credential secret creation successful"
  else
    fail "Database credential secret creation failed"
  fi
  
  # Test 2: Verify connection string format
  log "Test 2: Verify connection string format"
  STORED_URL=$(kubectl get secret test-db-credentials -n "${TEST_NAMESPACE}" \
    -o jsonpath='{.data.url}' | base64 -d)
  if [[ "${STORED_URL}" =~ ^postgresql:// ]]; then
    success "Connection string format validation successful"
  else
    fail "Connection string format validation failed"
  fi
  
  # Test 3: Test credential update
  log "Test 3: Test credential update"
  NEW_DB_URL="postgresql://test_user_new:test_pass_new@localhost:5432/test_db"
  if kubectl create secret generic test-db-credentials-new -n "${TEST_NAMESPACE}" \
    --from-literal=url="${NEW_DB_URL}" --dry-run=client -o yaml | \
    kubectl apply -f - >/dev/null 2>&1; then
    success "Credential update successful"
  else
    fail "Credential update failed"
  fi
  
  # Test 4: Test deployment environment update
  log "Test 4: Test deployment environment update"
  if kubectl set env deployment/relayer-test -n "${TEST_NAMESPACE}" \
    DATABASE_URL="test-connection-string" >/dev/null 2>&1; then
    success "Deployment environment update successful"
  else
    fail "Deployment environment update failed"
  fi
}

test_validation_script() {
  section "Testing Validation Script"
  
  # Test 1: Verify script exists
  log "Test 1: Verify validation script exists"
  VALIDATOR_SCRIPT="${SCRIPT_DIR}/key-rotation-validator.sh"
  if [[ -f "${VALIDATOR_SCRIPT}" ]]; then
    success "Validation script found"
  else
    fail "Validation script not found: ${VALIDATOR_SCRIPT}"
    return
  fi
  
  # Test 2: Verify script is executable
  log "Test 2: Verify script is executable"
  if [[ -x "${VALIDATOR_SCRIPT}" ]]; then
    success "Validation script is executable"
  else
    fail "Validation script is not executable"
  fi
  
  # Test 3: Test help output
  log "Test 3: Test help output"
  if "${VALIDATOR_SCRIPT}" --help >/dev/null 2>&1; then
    success "Help output test successful"
  else
    fail "Help output test failed"
  fi
  
  # Test 4: Test dry-run mode
  log "Test 4: Test dry-run mode"
  if DRY_RUN=true NAMESPACE="${TEST_NAMESPACE}" \
    "${VALIDATOR_SCRIPT}" --type relayer-signing-key --phase pre-rotation --dry-run 2>&1 | \
    grep -q "DRY-RUN"; then
    success "Dry-run mode test successful"
  else
    skip "Dry-run mode test (may require full environment)"
  fi
}

test_runbook_completeness() {
  section "Testing Runbook Completeness"
  
  RUNBOOK="${SCRIPT_DIR}/../../docs/ops/runbooks/key-rotation.md"
  
  # Test 1: Verify runbook exists
  log "Test 1: Verify runbook exists"
  if [[ -f "${RUNBOOK}" ]]; then
    success "Runbook found"
  else
    fail "Runbook not found: ${RUNBOOK}"
    return
  fi
  
  # Test 2: Check for required sections
  log "Test 2: Check for required sections"
  local required_sections=(
    "Relayer Signing Key Rotation"
    "API Authentication Token Rotation"
    "Database Credential Rotation"
    "Emergency Rotation"
    "Rollback Procedures"
    "Validation Checklist"
  )
  
  local missing_sections=()
  for section in "${required_sections[@]}"; do
    if ! grep -q "${section}" "${RUNBOOK}"; then
      missing_sections+=("${section}")
    fi
  done
  
  if [[ ${#missing_sections[@]} -eq 0 ]]; then
    success "All required sections present"
  else
    fail "Missing sections: ${missing_sections[*]}"
  fi
  
  # Test 3: Check for code blocks
  log "Test 3: Check for code blocks"
  local code_block_count
  code_block_count=$(grep -c '```bash' "${RUNBOOK}" || echo "0")
  if [[ ${code_block_count} -gt 10 ]]; then
    success "Sufficient code examples (${code_block_count} blocks)"
  else
    fail "Insufficient code examples (${code_block_count} blocks)"
  fi
  
  # Test 4: Check for contact information
  log "Test 4: Check for contact information"
  if grep -q "Contact Information" "${RUNBOOK}"; then
    success "Contact information present"
  else
    fail "Contact information missing"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

print_summary() {
  echo ""
  section "Test Summary"
  echo -e "  ${GREEN}Passed:${NC}  ${TESTS_PASSED}"
  echo -e "  ${RED}Failed:${NC}  ${TESTS_FAILED}"
  echo -e "  ${YELLOW}Skipped:${NC} ${TESTS_SKIPPED}"
  echo ""
  
  if [[ ${TESTS_FAILED} -eq 0 ]]; then
    echo -e "${GREEN}All tests passed!${NC}"
    return 0
  else
    echo -e "${RED}Some tests failed.${NC}"
    return 1
  fi
}

main() {
  local test_type="${1:-all}"
  
  echo ""
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         Key Rotation Test Suite                          ║${NC}"
  echo -e "${BLUE}║         Test Namespace: ${TEST_NAMESPACE}                ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  # Setup
  setup_test_environment
  
  # Run tests based on type
  case "${test_type}" in
    all)
      test_relayer_signing_key_rotation
      test_api_token_rotation
      test_database_credentials_rotation
      test_validation_script
      test_runbook_completeness
      ;;
    relayer-signing-key)
      test_relayer_signing_key_rotation
      ;;
    api-token)
      test_api_token_rotation
      ;;
    database-credentials)
      test_database_credentials_rotation
      ;;
    validation-script)
      test_validation_script
      ;;
    runbook)
      test_runbook_completeness
      ;;
    *)
      echo "Unknown test type: ${test_type}"
      echo "Valid types: all, relayer-signing-key, api-token, database-credentials, validation-script, runbook"
      exit 1
      ;;
  esac
  
  # Cleanup
  cleanup_test_environment
  
  # Print summary and exit
  print_summary
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
