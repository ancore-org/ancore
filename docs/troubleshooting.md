# Troubleshooting Guide: Common Error Codes and Recovery Steps

Use this guide when Ancore or the Stellar network reports an error. Error codes do not expose your
recovery phrase or private keys, so you can safely reference the code and timestamp when asking for help.

> [!WARNING]
> Never share your 12/24-word recovery phrase, private keys, or wallet password with anyone, including support staff.

---

## Quick Reference Index

| Error Code | Category | Severity | Common Cause |
|------------|----------|----------|--------------|
| [`unlock_rate_limited`](#unlock_rate_limited) | Security / Vault | Medium | Repeated failed password attempts |
| [`insufficient_balance`](#insufficient_balance) | Transactions | Low | Balance below transfer amount + reserve |
| [`memo_required`](#memo_required) | Transactions | Medium | Destination exchange requires deposit memo |
| [`invalid_signature`](#invalid_signature) | Crypto / Auth | Medium | Expired request, altered payload, or signer mismatch |
| [`session_key_expired`](#session_key_expired) | Session Keys | Low | Session validity period elapsed |
| [`session_key_limit_exceeded`](#session_key_limit_exceeded) | Session Keys | Medium | Attempted spend exceeds authorized policy limit |
| [`network_timeout`](#network_timeout) | Network / RPC | Medium | RPC node unresponsive or congested |
| [`rpc_rate_limited`](#rpc_rate_limited) | Network / RPC | Low | Too many RPC requests dispatched |
| [`vault_not_found`](#vault_not_found) | Storage | High | Local storage wiped or fresh browser profile |
| [`contract_not_found`](#contract_not_found) | Smart Contracts | High | Contract not deployed on selected network |
| [`tx_bad_seq`](#tx_bad_seq) | Consensus | Low | Sequence number race from concurrent transactions |

---

## Error Codes & Recovery Steps

### `unlock_rate_limited`

**What it means:** Repeated incorrect passwords were submitted in a short period. The extension enforces exponential backoff to protect the vault against brute-force attacks.

**Recovery Steps:**
1. Wait for the lockout timer displayed on screen (e.g. 1 minute for 5 attempts, doubling up to 15 minutes).
2. Ensure Caps Lock is off and re-enter your password carefully.
3. If you have forgotten your password, use your 12- or 24-word recovery phrase to restore your wallet.

---

### `insufficient_balance`

**What it means:** The account does not have enough available balance to cover the payment amount and Stellar network fees, taking into account the base reserve requirement (minimum 0.5 to 1 XLM locked per account and trustline).

**Recovery Steps:**
1. Check your account balance on the Dashboard or Explorer.
2. Ensure you leave at least 1.0 XLM available for base reserve and fee headroom.
3. If sending non-native tokens, verify both your token balance and your native XLM balance (needed for gas/stroop fees).

---

### `memo_required`

**What it means:** The destination address belongs to a centralized exchange (such as Binance, Coinbase, or Kraken) that aggregates deposits into a single address and requires a numerical or text memo to credit your specific user account.

**Recovery Steps:**
1. Retrieve the exact Memo (Text, ID, or Hash) from your exchange deposit interface.
2. Re-open the Send flow and toggle "Add Memo".
3. Paste the required memo before approving submission. Never send funds to an exchange without the required deposit memo.

---

### `invalid_signature`

**What it means:** The cryptographic signature could not be verified by the Stellar network or Soroban runtime. This occurs if the transaction was modified after signing, signed by an unauthorized key, or if the authorization entry has expired.

**Recovery Steps:**
1. Reject the pending approval request in the extension.
2. Verify that the correct account is active in the popup header.
3. If interacting with a dApp, refresh the dApp page and submit a fresh approval request.
4. For hardware wallet users (Ledger), confirm the app is open on the device and blind signing is enabled if required.

---

### `session_key_expired`

**What it means:** The active session key's time-to-live (`valid_until` timestamp) has elapsed. Transactions signed with this session key are rejected by the smart account contract.

**Recovery Steps:**
1. Open the dApp and initiate a session key renewal or re-connection.
2. In the Ancore Extension, navigate to **Settings → Session Keys** to review active and expired session keys.
3. Authorize a new session key with an updated expiry TTL.

---

### `session_key_limit_exceeded`

**What it means:** The dApp attempted to transfer an amount or execute a contract invocation that exceeds the maximum spend limit or contract allowlist authorized for this session key.

**Recovery Steps:**
1. Check the permitted spend limit in **Settings → Session Keys**.
2. If the transaction was intended, either execute it directly using your main account password, or revoke the current session key and authorize a new key with higher limits.

---

### `network_timeout`

**What it means:** The request to Horizon or the Soroban RPC endpoint timed out without a final response. This does **not** always mean the transaction failed; it may still be pending inclusion in a ledger.

**Recovery Steps:**
1. Do **not** spam the submit button to avoid accidental duplicate payments.
2. Wait 10-15 seconds and check your transaction history or account balance.
3. Check the Stellar network status page or select an alternate RPC provider in **Settings → Network**.

---

### `rpc_rate_limited`

**What it means:** The public or configured Soroban RPC provider responded with HTTP 429 Too Many Requests.

**Recovery Steps:**
1. Wait 5-10 seconds before refreshing balances or submitting operations.
2. For power users, configure a custom Soroban RPC endpoint (e.g. via QuickNode, Blockdaemon, or a dedicated node) in **Settings → Network Settings**.

---

### `vault_not_found`

**What it means:** The local encrypted storage partition for the wallet could not be found. This occurs if browser history/cache was completely cleared or a new browser profile is in use.

**Recovery Steps:**
1. Check if you are using the correct browser profile.
2. On the welcome screen, select **"Restore Wallet"** and enter your 12- or 24-word recovery phrase.
3. Re-enter your desired encryption password to re-create the local encrypted vault.

---

### `contract_not_found`

**What it means:** The smart account or target contract is not deployed on the selected network (e.g. attempting to interact with a testnet contract address while connected to Mainnet).

**Recovery Steps:**
1. Check the network pill badge in the extension header.
2. Switch to the matching network (**Testnet**, **Mainnet**, or **Futurenet**) in **Settings → Network**.
3. For newly generated smart accounts, ensure the contract has been deployed by funding the address or running the factory deployment step.

---

### `tx_bad_seq`

**What it means:** The transaction sequence number does not match the source account's current sequence on the ledger. This typically happens when multiple transactions are submitted rapidly before preceding transactions settle.

**Recovery Steps:**
1. Wait 5 seconds for previous in-flight transactions to finalize.
2. Refresh the wallet or dApp to fetch the latest sequence number from the network.
3. Re-submit the transaction.

---

## Diagnostic Logs & Reporting

When reporting an issue to maintainers:
1. Provide the exact error code and timestamp.
2. Provide your active network (Mainnet, Testnet, or Futurenet).
3. Do **NOT** post private keys, recovery seed words, or plaintext passwords.
4. For developer logs, open Chrome DevTools on the extension popup or background worker (`chrome://extensions` → "Inspect views: service worker").
