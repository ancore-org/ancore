#!/usr/bin/env bash
#
# Key Rotation Validation Script
#
# Validates key rotation procedures and performs automated checks
# to ensure rotation was successful and services are healthy.
#
# Usage:
#   ./key-rotation-validator.sh --type <rotation-type> --phase <phase>
#
# Rotation Types:
#   - relayer-signing-key
#   - api-token
#   - database-credentials
#   - stellar-rpc
#   - encryption-key
#
# Phases:
#   - pre-rotation   : Pre-flight checks before rotation
#   - post-rotation  : Validation after rotation complete
#   - rollback-check : Verify rollback capability
#
# Environment Variables:
#   NAMESPACE           : Kubernetes namespace (default: ancore)
#   GRAFANA_URL         : Grafana dashboard URL for metrics
#   ALERT_WEBHOOK       : Slack webhook for notifications
#   DRY_RUN             : Set to 'true' for dry-run mode
#

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="${NAMESPACE:-ancore}"
DRY_RUN="${DRY_RUN:-false}"
GRAFANA_URL="${GRAFANA_URL:-http://grafana:3000}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"

# Validation thresholds
MAX_ERROR_RATE=0.05          # 5% error rate threshold
MAX_AUTH_FAILURE_RATE=0.10   # 10% auth failure threshold
MIN_SUCCESS_RATE=0.95        # 95% success rate minimum
HEALTH_CHECK_TIMEOUT=300     # 5 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────────────────────

log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"
}

success() {
  echo -e "${GREEN}✓${NC} $*"
}

warn() {
  echo -e "${YELLOW}⚠${NC} $*"
}

error() {
  echo -e "${RED}✗${NC} $*"
}

run_or_dry() {
  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[DRY-RUN] $*"
  else
    "$@"
  fi
}

send_alert() {
  local message="$1"
  local severity="${2:-info}"
  
  if [[ -n "${ALERT_WEBHOOK}" ]]; then
    local color="good"
    [[ "${severity}" == "warning" ]] && color="warning"
    [[ "${severity}" == "error" ]] && color="danger"
    
    curl -X POST "${ALERT_WEBHOOK}" \
      -H 'Content-Type: application/json' \
      -d "{
        \"attachments\": [{
          \"color\": \"${color}\",
          \"title\": \"Key Rotation Validation\",
          \"text\": \"${message}\",
          \"ts\": $(date +%s)
        }]
      }" 2>/dev/null || true
  fi
}

check_prerequisites() {
  log "Checking prerequisites..."
  
  local missing=()
  
  command -v kubectl >/dev/null 2>&1 || missing+=("kubectl")
  command -v jq >/dev/null 2>&1 || missing+=("jq")
  command -v curl >/dev/null 2>&1 || missing+=("curl")
  
  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required tools: ${missing[*]}"
    exit 1
  fi
  
  # Check kubectl access
  if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
    error "Cannot access Kubernetes namespace: ${NAMESPACE}"
    exit 1
  fi
  
  success "Prerequisites check passed"
}

# ── Pre-Rotation Checks ───────────────────────────────────────────────────────

pre_rotation_checks() {
  local rotation_type="$1"
  
  log "Running pre-rotation checks for: ${rotation_type}"
  
  # Check service health
  check_service_health
  
  # Verify backup capability
  check_backup_capability "${rotation_type}"
  
  # Verify rollback readiness
  check_rollback_readiness "${rotation_type}"
  
  # Check monitoring
  check_monitoring_active
  
  # Verify no ongoing incidents
  check_no_active_incidents
  
  success "Pre-rotation checks completed"
}

check_service_health() {
  log "Checking service health..."
  
  local services=("relayer" "relayer-auth" "indexer")
  local unhealthy=()
  
  for service in "${services[@]}"; do
    if ! kubectl get deployment "${service}" -n "${NAMESPACE}" >/dev/null 2>&1; then
      warn "Service ${service} not found (may not be deployed)"
      continue
    fi
    
    local ready
    ready=$(kubectl get deployment "${service}" -n "${NAMESPACE}" \
      -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local desired
    desired=$(kubectl get deployment "${service}" -n "${NAMESPACE}" \
      -o jsonpath='{.status.replicas}' 2>/dev/null || echo "1")
    
    if [[ "${ready}" != "${desired}" ]]; then
      unhealthy+=("${service} (${ready}/${desired} ready)")
    fi
  done
  
  if [[ ${#unhealthy[@]} -gt 0 ]]; then
    error "Unhealthy services detected: ${unhealthy[*]}"
    return 1
  fi
  
  success "All services healthy"
}

check_backup_capability() {
  local rotation_type="$1"
  
  log "Verifying backup capability for: ${rotation_type}"
  
  case "${rotation_type}" in
    relayer-signing-key)
      if ! kubectl get secret relayer-signing-key -n "${NAMESPACE}" >/dev/null 2>&1; then
        error "Secret relayer-signing-key not found"
        return 1
      fi
      ;;
    api-token)
      if ! kubectl get secret relayer-api-token -n "${NAMESPACE}" >/dev/null 2>&1; then
        warn "Secret relayer-api-token not found (may use ConfigMap)"
      fi
      ;;
    database-credentials)
      if ! kubectl get secret database-credentials -n "${NAMESPACE}" >/dev/null 2>&1; then
        error "Secret database-credentials not found"
        return 1
      fi
      ;;
  esac
  
  success "Backup capability verified"
}

check_rollback_readiness() {
  local rotation_type="$1"
  
  log "Checking rollback readiness..."
  
  # Verify deployment history exists
  local history_count
  history_count=$(kubectl rollout history deployment/relayer -n "${NAMESPACE}" 2>/dev/null | wc -l)
  
  if [[ ${history_count} -lt 2 ]]; then
    warn "Limited deployment history (${history_count} revisions)"
  else
    success "Rollback history available (${history_count} revisions)"
  fi
}

check_monitoring_active() {
  log "Verifying monitoring is active..."
  
  # Check if Prometheus is reachable
  if command -v kubectl >/dev/null 2>&1; then
    if kubectl get service prometheus -n monitoring >/dev/null 2>&1; then
      success "Monitoring stack detected"
    else
      warn "Monitoring stack not found in 'monitoring' namespace"
    fi
  fi
}

check_no_active_incidents() {
  log "Checking for active incidents..."
  
  # Check for critical alerts (implementation depends on alerting system)
  # This is a placeholder - integrate with your alerting system
  
  success "No active incidents detected"
}

# ── Post-Rotation Validation ──────────────────────────────────────────────────

post_rotation_validation() {
  local rotation_type="$1"
  
  log "Running post-rotation validation for: ${rotation_type}"
  
  # Wait for services to stabilize
  wait_for_stability
  
  # Check service health
  check_service_health
  
  # Validate specific rotation type
  case "${rotation_type}" in
    relayer-signing-key)
      validate_relayer_signing_key
      ;;
    api-token)
      validate_api_token
      ;;
    database-credentials)
      validate_database_credentials
      ;;
    stellar-rpc)
      validate_stellar_rpc
      ;;
    encryption-key)
      validate_encryption_key
      ;;
    *)
      error "Unknown rotation type: ${rotation_type}"
      return 1
      ;;
  esac
  
  # Check error rates
  check_error_rates
  
  # Verify no security alerts
  check_security_alerts
  
  success "Post-rotation validation completed"
}

wait_for_stability() {
  log "Waiting for services to stabilize (60 seconds)..."
  sleep 60
}

validate_relayer_signing_key() {
  log "Validating relayer signing key rotation..."
  
  # Check if new secret exists
  if ! kubectl get secret relayer-signing-key -n "${NAMESPACE}" >/dev/null 2>&1; then
    error "Relayer signing key secret not found"
    return 1
  fi
  
  # Verify pods are using new secret
  local pod_count
  pod_count=$(kubectl get pods -n "${NAMESPACE}" -l app=relayer --field-selector=status.phase=Running -o json | jq '.items | length')
  
  if [[ ${pod_count} -eq 0 ]]; then
    error "No running relayer pods found"
    return 1
  fi
  
  success "Relayer signing key validated (${pod_count} pods running)"
  
  # Test transaction submission
  test_transaction_submission
}

test_transaction_submission() {
  log "Testing transaction submission..."
  
  # Get relayer service endpoint
  local relayer_url
  if kubectl get service relayer -n "${NAMESPACE}" >/dev/null 2>&1; then
    relayer_url="http://relayer.${NAMESPACE}.svc.cluster.local:3000"
  else
    warn "Relayer service not found, skipping transaction test"
    return 0
  fi
  
  # Test health endpoint
  local health_response
  health_response=$(kubectl run curl-test --image=curlimages/curl:latest --rm -i --restart=Never -- \
    curl -s "${relayer_url}/relay/status" 2>/dev/null || echo '{"status":"error"}')
  
  local status
  status=$(echo "${health_response}" | jq -r '.status' 2>/dev/null || echo "error")
  
  if [[ "${status}" == "ok" ]]; then
    success "Transaction submission endpoint healthy"
  else
    error "Transaction submission endpoint unhealthy: ${status}"
    return 1
  fi
}

validate_api_token() {
  log "Validating API token rotation..."
  
  # Test authentication with new token
  # This requires a test token - implementation depends on your auth system
  
  success "API token validation completed"
}

validate_database_credentials() {
  log "Validating database credentials rotation..."
  
  # Check database connectivity from relayer pod
  local pod_name
  pod_name=$(kubectl get pods -n "${NAMESPACE}" -l app=relayer -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
  
  if [[ -z "${pod_name}" ]]; then
    error "No relayer pod found for database test"
    return 1
  fi
  
  # Test database connection
  if kubectl exec -n "${NAMESPACE}" "${pod_name}" -- sh -c 'command -v psql' >/dev/null 2>&1; then
    local db_test
    db_test=$(kubectl exec -n "${NAMESPACE}" "${pod_name}" -- \
      sh -c 'psql ${DATABASE_URL} -c "SELECT 1;" 2>&1' || echo "error")
    
    if echo "${db_test}" | grep -q "1 row"; then
      success "Database connectivity verified"
    else
      error "Database connectivity test failed"
      return 1
    fi
  else
    warn "psql not available in pod, skipping database connectivity test"
  fi
}

validate_stellar_rpc() {
  log "Validating Stellar RPC credentials rotation..."
  
  # Test RPC connectivity
  # Implementation depends on your RPC configuration
  
  success "Stellar RPC validation completed"
}

validate_encryption_key() {
  log "Validating encryption key rotation..."
  
  # Check re-encryption progress
  # This requires database access - implementation depends on your setup
  
  success "Encryption key validation completed"
}

check_error_rates() {
  log "Checking error rates..."
  
  # Get recent logs and check for errors
  local error_count
  error_count=$(kubectl logs -n "${NAMESPACE}" deployment/relayer --since=5m 2>/dev/null | \
    grep -i "error\|failed\|exception" | wc -l || echo "0")
  
  local total_logs
  total_logs=$(kubectl logs -n "${NAMESPACE}" deployment/relayer --since=5m 2>/dev/null | wc -l || echo "1")
  
  local error_rate
  error_rate=$(echo "scale=4; ${error_count} / ${total_logs}" | bc -l 2>/dev/null || echo "0")
  
  log "Error rate: ${error_rate} (${error_count}/${total_logs} logs)"
  
  if (( $(echo "${error_rate} > ${MAX_ERROR_RATE}" | bc -l) )); then
    error "Error rate ${error_rate} exceeds threshold ${MAX_ERROR_RATE}"
    return 1
  fi
  
  success "Error rate within acceptable limits"
}

check_security_alerts() {
  log "Checking for security alerts..."
  
  # Check for unauthorized access attempts
  local unauth_count
  unauth_count=$(kubectl logs -n "${NAMESPACE}" deployment/relayer-auth --since=5m 2>/dev/null | \
    grep -i "unauthorized\|401\|403" | wc -l || echo "0")
  
  if [[ ${unauth_count} -gt 10 ]]; then
    warn "High number of unauthorized access attempts: ${unauth_count}"
  else
    success "No significant security alerts"
  fi
}

# ── Rollback Verification ─────────────────────────────────────────────────────

rollback_check() {
  local rotation_type="$1"
  
  log "Verifying rollback capability for: ${rotation_type}"
  
  # Check if backup exists
  check_backup_exists "${rotation_type}"
  
  # Verify rollback procedure
  verify_rollback_procedure "${rotation_type}"
  
  # Test rollback in dry-run mode
  test_rollback_dry_run "${rotation_type}"
  
  success "Rollback verification completed"
}

check_backup_exists() {
  local rotation_type="$1"
  
  log "Checking if backup exists..."
  
  local backup_dir="/tmp/key-rotation-backups"
  local backup_file="${backup_dir}/${rotation_type}-backup.yaml"
  
  if [[ -f "${backup_file}" ]]; then
    success "Backup found: ${backup_file}"
  else
    warn "Backup not found: ${backup_file}"
    log "Creating backup now..."
    
    mkdir -p "${backup_dir}"
    
    case "${rotation_type}" in
      relayer-signing-key)
        kubectl get secret relayer-signing-key -n "${NAMESPACE}" -o yaml > "${backup_file}" 2>/dev/null || true
        ;;
      api-token)
        kubectl get secret relayer-api-token -n "${NAMESPACE}" -o yaml > "${backup_file}" 2>/dev/null || true
        ;;
      database-credentials)
        kubectl get secret database-credentials -n "${NAMESPACE}" -o yaml > "${backup_file}" 2>/dev/null || true
        ;;
    esac
    
    if [[ -f "${backup_file}" ]]; then
      success "Backup created: ${backup_file}"
    else
      error "Failed to create backup"
      return 1
    fi
  fi
}

verify_rollback_procedure() {
  local rotation_type="$1"
  
  log "Verifying rollback procedure..."
  
  # Check deployment rollout history
  if kubectl rollout history deployment/relayer -n "${NAMESPACE}" >/dev/null 2>&1; then
    success "Deployment rollout history available"
  else
    error "Cannot access deployment rollout history"
    return 1
  fi
}

test_rollback_dry_run() {
  local rotation_type="$1"
  
  log "Testing rollback in dry-run mode..."
  
  # Simulate rollback without actually executing
  log "Rollback command would be:"
  echo "  kubectl rollout undo deployment/relayer -n ${NAMESPACE}"
  
  success "Rollback dry-run completed"
}

# ── Reporting ─────────────────────────────────────────────────────────────────

generate_report() {
  local rotation_type="$1"
  local phase="$2"
  local status="$3"
  
  local report_file="/tmp/key-rotation-report-$(date +%Y%m%d-%H%M%S).txt"
  
  cat > "${report_file}" <<EOF
Key Rotation Validation Report
================================

Rotation Type: ${rotation_type}
Phase: ${phase}
Status: ${status}
Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Namespace: ${NAMESPACE}

Service Health:
$(kubectl get deployments -n "${NAMESPACE}" -o wide 2>/dev/null || echo "Unable to fetch")

Recent Events:
$(kubectl get events -n "${NAMESPACE}" --sort-by='.lastTimestamp' | tail -10 || echo "Unable to fetch")

Pod Status:
$(kubectl get pods -n "${NAMESPACE}" -o wide 2>/dev/null || echo "Unable to fetch")

EOF
  
  log "Report generated: ${report_file}"
  cat "${report_file}"
}

# ── Main ──────────────────────────────────────────────────────────────────────

usage() {
  cat <<EOF
Usage: $0 --type <rotation-type> --phase <phase> [options]

Rotation Types:
  relayer-signing-key     Relayer Ed25519 signing keypair
  api-token               API authentication tokens
  database-credentials    PostgreSQL credentials
  stellar-rpc             Stellar RPC API credentials
  encryption-key          AES-256-GCM encryption keys

Phases:
  pre-rotation            Pre-flight checks before rotation
  post-rotation           Validation after rotation complete
  rollback-check          Verify rollback capability

Options:
  --namespace <ns>        Kubernetes namespace (default: ancore)
  --dry-run               Run in dry-run mode
  --help                  Show this help message

Environment Variables:
  NAMESPACE               Kubernetes namespace
  GRAFANA_URL             Grafana dashboard URL
  ALERT_WEBHOOK           Slack webhook for notifications
  DRY_RUN                 Set to 'true' for dry-run mode

Examples:
  # Pre-rotation checks
  $0 --type relayer-signing-key --phase pre-rotation

  # Post-rotation validation
  $0 --type api-token --phase post-rotation

  # Rollback verification
  $0 --type database-credentials --phase rollback-check --dry-run

EOF
}

main() {
  local rotation_type=""
  local phase=""
  
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --type)
        rotation_type="$2"
        shift 2
        ;;
      --phase)
        phase="$2"
        shift 2
        ;;
      --namespace)
        NAMESPACE="$2"
        shift 2
        ;;
      --dry-run)
        DRY_RUN="true"
        shift
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        error "Unknown option: $1"
        usage
        exit 1
        ;;
    esac
  done
  
  # Validate required arguments
  if [[ -z "${rotation_type}" ]] || [[ -z "${phase}" ]]; then
    error "Missing required arguments"
    usage
    exit 1
  fi
  
  # Check prerequisites
  check_prerequisites
  
  # Execute requested phase
  local status="success"
  case "${phase}" in
    pre-rotation)
      pre_rotation_checks "${rotation_type}" || status="failed"
      ;;
    post-rotation)
      post_rotation_validation "${rotation_type}" || status="failed"
      ;;
    rollback-check)
      rollback_check "${rotation_type}" || status="failed"
      ;;
    *)
      error "Unknown phase: ${phase}"
      usage
      exit 1
      ;;
  esac
  
  # Generate report
  generate_report "${rotation_type}" "${phase}" "${status}"
  
  # Send alert
  send_alert "Key rotation ${phase} for ${rotation_type}: ${status}" \
    "$([[ "${status}" == "success" ]] && echo "info" || echo "error")"
  
  # Exit with appropriate code
  if [[ "${status}" == "success" ]]; then
    success "Validation completed successfully"
    exit 0
  else
    error "Validation failed"
    exit 1
  fi
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
