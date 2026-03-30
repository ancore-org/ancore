# Troubleshooting and Security Best Practices

Use this guide when diagnosing user issues or applying wallet hardening controls.

## Quick Triage

1. Confirm wallet version and browser version.
2. Confirm selected network (Testnet/Mainnet).
3. Confirm internet connectivity.
4. Ask for exact error text and timestamp.
5. Reproduce issue with smallest possible workflow.

## Common Issues

### Extension Does Not Open

- Restart browser.
- Disable conflicting extensions.
- Reinstall extension from trusted source.

### Transaction Fails or Stalls

- Check available balance includes fees.
- Verify recipient address format.
- Retry after network status stabilizes.

### QR Code Cannot Be Scanned

- Increase display brightness.
- Enlarge QR display area.
- Avoid screen reflections.

### Session Key Not Working

- Check whether key is expired.
- Validate permission scope allows action.
- Revoke and create a new constrained key.

## Security Best Practices

### Wallet Hygiene

- Lock device with biometrics or strong passcode.
- Keep OS and browser patched.
- Use a dedicated browser profile for wallet use.

### Recovery Phrase Safety

- Store phrase offline in two separate secure locations.
- Never share phrase through chat, email, or screenshots.
- Perform periodic readability checks.

### Transaction Safety

- Verify recipient address from trusted source.
- Perform a small test transfer before large payments.
- Review all details on confirmation screen.

### Session Key Safety

- Use short expiration windows.
- Apply least-privilege permissions.
- Revoke keys immediately after use.

## Escalation Template

If an issue persists, capture:

- Wallet version
- Browser version
- Network selected
- Steps to reproduce
- Error message and timestamp
- Screenshots (without secrets)

Then escalate to engineering/security triage with severity tags.
