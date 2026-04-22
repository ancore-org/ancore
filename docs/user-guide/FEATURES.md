# Feature Documentation

This document explains the core wallet workflows: sending payments, receiving funds, and managing session keys.

## Sending Payments

### Steps

1. Open **Send**.
2. Enter or paste recipient address.
3. Select amount and asset.
4. Review summary (recipient, amount, fees).
5. Confirm and sign.

### Tips

- Validate recipient addresses from a trusted channel.
- Send a small test amount for first-time recipients.
- Keep enough balance for network fees.

### Common Errors

- **Insufficient balance**: Reduce amount or fund wallet.
- **Invalid address**: Re-check copy/paste source.
- **Network unavailable**: Retry after connection recovers.

## Receiving Payments

### Steps

1. Open **Receive**.
2. Copy your wallet address or display QR code.
3. Share address with sender.
4. Wait for network confirmation.

### Tips

- Use QR codes to avoid manual typing.
- Verify network selection matches the sender's network.
- Use transaction history to confirm settlement.

## Session Keys

Session keys allow limited, time-bound permissions without repeatedly exposing your primary signing key.

### Typical Use Cases

- Frequent low-risk actions
- Limited automation flows
- Temporary access windows

### Managing Session Keys

1. Open **Session Keys**.
2. Create a key with:
   - Purpose label
   - Permission scope
   - Expiration time
3. Save and monitor active keys.
4. Revoke keys that are no longer needed.

### Security Notes

- Keep session key scope as narrow as possible.
- Use short expirations by default.
- Revoke immediately if suspicious activity appears.
