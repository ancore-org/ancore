# @ancore/wallet-api

Browser SDK for dApps integrating with the **Ancore Wallet** extension.

Production reference: [@stellar/freighter-api](https://github.com/stellar/freighter/tree/master/@stellar/freighter-api).

## Status

**Scaffold only.** Protocol and SDK are defined; background handlers tracked in [FREIGHTER_COMPARISON](../../docs/wallets/FREIGHTER_COMPARISON.md).

## Install (future)

```bash
pnpm add @ancore/wallet-api
```

## Usage (target)

```typescript
import { requestAccess, signTransaction } from '@ancore/wallet-api';

const { smartAccountId } = await requestAccess();
const { signedXdr } = await signTransaction({
  xdr: unsignedXdr,
  networkPassphrase: 'Test SDF Network ; September 2015',
});
```

## Ancore vs Freighter

| Freighter           | Ancore                                                |
| ------------------- | ----------------------------------------------------- |
| Classic G-address   | **Smart account contract id** (primary address)       |
| `getAddress()` → G… | `getAddress()` → C… + optional owner G…               |
| Direct key sign     | Owner key or **session key** via contract permissions |
| Horizon submit      | Optional **relayer** submit for AA meta-txs           |

Do not remove AA-specific methods when implementing handlers.

## Protocol

PostMessage types live in `@ancore/wallet-shared`. Content script validates `ANCOR_WALLET_REQUEST` before forwarding to the background service worker.
