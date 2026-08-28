# Ledger hardware signing

Ancore can sign **classic G-address** and **smart-account owner** operations with a Ledger device over WebHID. Session-key AA signing stays in the software vault unless a separate policy is designed later.

## Supported devices

| Device | Transport | Notes |
|--------|-----------|-------|
| Ledger Nano S Plus / X / Stax / Flex | WebHID | Stellar app must be open on the device |
| Browser | Chrome / Edge / Brave | Extension popup or approval tab (user gesture required) |

WebHID has no MV3 manifest permission — pairing uses `navigator.hid.requestDevice()` from a visible extension page. Do **not** call Ledger APIs from the service worker.

## Extension UX

1. **Settings → Hardware wallet** — set BIP-44 account index (`m/44'/148'/n'`), connect Ledger, confirm address on device.
2. Prefer **Ledger** as signer (or keep **Software vault**).
3. Send / approval flows show a device prompt; the popup runs `LedgerSigningAdapter` and never exports the software seed while Ledger mode is active.

## SDK

```ts
import { LedgerSigningAdapter, stellarBip44Path } from '@ancore/core-sdk';

const adapter = new LedgerSigningAdapter({ accountIndex: 0 });
await adapter.connect();
const { publicKey } = await adapter.getPublicKey(true);
const signedXdr = await adapter.sign(unsignedXdr, networkPassphrase);
await adapter.disconnect();
```

Typed errors: `LedgerSigningError` with `LedgerErrorCode` (`USER_REJECTED`, `APP_NOT_OPEN`, `LOCKED`, …).

## Limitations vs session-key AA

- Ledger signs **owner** / G-address envelopes (and Soroban auth entries when the Stellar app supports it).
- Time-limited **session keys** remain software-derived and are not exported to the device.
- dApp approval still queues in the background; hardware signing completes in the approval UI after the user gesture.

## Testing without a device

Unit tests inject a mock transport + `@ledgerhq/hw-app-str` surface (see `packages/core-sdk/src/signing/__tests__/ledger-adapter.test.ts`). Extension helpers mock `LedgerSigningAdapter` in Vitest.
