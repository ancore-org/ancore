# Runbook: StellarNodeBehind / StellarNodeDown

## Alert
Fires when the Stellar node is more than 30 seconds behind the current network time, or when the stellar-core service is unreachable.

## Severity & Escalation
- **Level:** critical
- **Escalation:** PagerDuty → on-call
- **Escalation path:** On-call engineer → Platform lead → CTO (> 30 min unresolved)

## Diagnosis Steps
1. Check stellar-core service status:
```bash
# Kubernetes
kubectl logs -n ancore deploy/stellar-core --tail=100 --since=10m
# Docker
docker logs stellar-core --tail=100
```
2. Check if the node is connected to peers:
```bash
# Check stellar-core peer connections
stellar-core --c info
```
3. Check network connectivity to Stellar peers
4. Check disk space (Stellar requires significant disk for ledger history)
5. Check CPU and memory resources
6. Verify the node is using the correct network configuration (mainnet vs testnet)

## Remediation
- **Restart stellar-core:** `kubectl rollout restart deploy/stellar-core`
- **Check network connectivity:** Ensure the node can reach Stellar peers
- **Free up disk space:** Stellar nodes need adequate disk space for ledger storage
- **Update stellar-core:** Ensure you're running a compatible version
- **Re-sync from scratch:** If the database is corrupted, you may need to re-sync
- **Check configuration:** Verify quorum set and peer configuration

## Prevention
- Monitor disk space closely (Stellar ledgers grow continuously)
- Set up automated alerts for peer connection count
- Implement regular backups of stellar-core database
- Use a managed Stellar node service if possible
- Monitor stellar-core logs for sync issues
- Set up multiple Stellar nodes for redundancy

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review Stellar node configuration and resources
- Consider adding redundant Stellar nodes for high availability
