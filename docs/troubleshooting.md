# Troubleshooting

Use this guide when Ancore shows an error code. Error codes do not expose your
recovery phrase or private keys, so you can safely include the code and time of
the error when asking support for help. Do **not** share a recovery phrase,
private key, password, or vault export.

## `unlock_rate_limited`

**What it means:** Too many incorrect unlock attempts were made in a short
period. The wallet temporarily pauses new attempts to protect your vault.

**What to do:** Wait for the timer shown by the wallet, then enter the correct
password carefully. If you do not remember the password, use your recovery
method instead of continuing to guess.

**Related:** [Wallet troubleshooting](user-guide/TROUBLESHOOTING.md) and
[security guidance](security/extension-wallet.md).

## `insufficient_balance`

**What it means:** The sending account does not have enough of the asset to
cover the payment and its Stellar network fee.

**What to do:** Reduce the amount, add funds to the account, or wait for an
incoming payment to settle. Leave a small amount of XLM available for fees.

**Related:** [Send-payment example](examples/send-payment.md) and
[FAQ](user-guide/FAQ.md).

## `invalid_signature`

**What it means:** The transaction approval could not be verified. This can
happen after a request has expired, when the selected account changed, or when
a session key is no longer valid.

**What to do:** Reject the request if you do not recognize it. Otherwise,
reopen the wallet, confirm the correct account and network, and create a new
request. If you use a session key, check that it has not expired or been
revoked.

**Related:** [Session-key lifecycle](examples/session-key-lifecycle.md) and
[session-key guide](guides/session-keys.md).

## `network_timeout`

**What it means:** Ancore could not get a response from the network service in
time. This does not always mean that a submitted transaction failed.

**What to do:** Check your connection, wait a moment, and refresh the activity
list before retrying. If you already approved a transaction, do not repeatedly
send it; first check whether it appears in your history.

**Related:** [Local services](development/local-services.md) and
[wallet troubleshooting](user-guide/TROUBLESHOOTING.md).

## `vault_not_found`

**What it means:** The wallet cannot find its encrypted local vault. Browser
data may have been cleared, a different browser profile may be open, or wallet
setup may not have completed.

**What to do:** Confirm that you are using the expected browser profile. If the
vault was removed, restore the wallet using your recovery phrase from a trusted,
private location. Never paste that phrase into a website or send it to support.

**Related:** [Getting started](user-guide/GETTING_STARTED.md) and
[extension wallet security](security/extension-wallet.md).

## `contract_not_found`

**What it means:** The smart-account contract address is not available on the
currently selected Stellar network. A testnet address, for example, will not
work on mainnet.

**What to do:** Check that the intended network is selected and copy the
contract address again from a trusted source. If the account has not been
created yet, complete account setup before sending a transaction.

**Related:** [Contract methods](contract-methods.md) and
[system architecture](architecture/OVERVIEW.md).

## Still need help?

Record the error code, wallet version, selected network, approximate time, and
the steps that led to the error. Include screenshots only after checking that
they contain no recovery phrase, password, private key, or transaction signing
secret.
