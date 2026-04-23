# Runbook: TransactionFailureRateHigh

## Alert
Fires when more than 5% of Stellar transactions are failing for more than 5 minutes.

## Severity & Escalation
- **Level:** warning
- **Escalation:** Slack #ancore-alerts
- **Escalation path:** On-call engineer → Platform lead (if not resolved in 2 hours)

## Diagnosis Steps
1. Check stellar-core logs for transaction failure reasons:
```bash
# Kubernetes
kubectl logs -n ancore deploy/stellar-core --tail=500 --since=15m | grep -i "tx\|transaction"
# Docker
docker logs stellar-core --tail=500 | grep -i "tx\|transaction"
```
2. Check if the Stellar network is experiencing issues
3. Check relayer service logs for submission errors
4. Verify account balances and sequence numbers
5. Check for rate limiting or throttling from Stellar network
6. Review recent code changes to transaction submission logic

## Remediation
- **Check Stellar network status:** Verify the network is operational
- **Retry failed transactions:** Implement exponential backoff retry logic
- **Check account sequence numbers:** Ensure sequence numbers are correct
- **Verify fee settings:** Ensure transaction fees are sufficient
- **Check rate limits:** Ensure you're not exceeding Stellar rate limits
- **Review transaction validation:** Check if transaction validation logic is correct

## Prevention
- Implement transaction submission with automatic retry
- Add monitoring for transaction success rates
- Set up alerts for network congestion
- Implement proper error handling for all transaction types
- Use Stellar's fee bump mechanism for stuck transactions
- Monitor account sequence numbers to prevent conflicts

## Post-Incident
- File incident report within 24 hours
- Update this runbook with new findings
- Review transaction submission logic
- Add integration tests for transaction failure scenarios
