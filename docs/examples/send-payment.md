# Example: Send Payment Flow

> End-to-end example for sending a Stellar payment via the Ancore SDK.  
> References: [`sdk-wrappers.md`](../sdk-wrappers.md) · [`contract-methods.md`](../contract-methods.md)  
> Last updated: 2026-04-24 · Issue #287

---

## Overview

`sendPayment` builds a Stellar `payment` operation, simulates it via Soroban
RPC, assembles the transaction, signs it, and submits it to the network.

**Flow**

```
1. Validate params
2. Build Operation.payment (native XLM or custom asset)
3. AccountTransactionBuilder.build() — simulate + assemble
4. signer.sign(tx.toXDR())          — sign the assembled transaction
5. stellarClient.submitTransaction() — submit to network
6. Return TransactionResult
```

---

## Prerequisites

```bash
pnpm add @ancore/core-sdk @ancore/stellar @stellar/stellar-sdk
```

---

## Basic example — send XLM

```typescript
import { sendPayment } from '@ancore/core-sdk';
import { StellarClient } from '@ancore/stellar';
import { Server } from '@stellar/stellar-sdk/rpc';
import { Account } from '@stellar/stellar-sdk';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const RPC_URL            = 'https://soroban-testnet.stellar.org';
const SOURCE_ADDRESS     = 'G...SOURCE';

// 1. Load source account (provides sequence number)
const server         = new Server(RPC_URL);
const accountData    = await server.getAccount(SOURCE_ADDRESS);
const sourceAccount  = new Account(accountData.id, accountData.sequence);

// 2. Set up StellarClient
const stellarClient = new StellarClient({ rpcUrl: RPC_URL });

// 3. Signer — adapt to your key management solution
const signer = {
  sign: async (transactionXdr: string): Promise<string> => {
    return myKeyManager.signTransaction(transactionXdr);
  },
};

// 4. Send
const result = await sendPayment(
  {
    to:     'G...DESTINATION',
    amount: '10.0000000',
    // asset defaults to native XLM
    signer,
  },
  {
    sourceAccount,
    builderOptions: {
      networkPassphrase: NETWORK_PASSPHRASE,
      server,
      fee: '100',
    },
    stellarClient,
  }
);

console.log('Status:', result.status);   // 'success'
console.log('Hash:',   result.hash);
console.log('Ledger:', result.ledger);
```

---

## Send a non-native asset (e.g. USDC)

```typescript
const result = await sendPayment(
  {
    to:     'G...DESTINATION',
    amount: '25.0000000',
    asset:  {
      code:   'USDC',
      issuer: 'G...USDC_ISSUER',
    },
    signer,
  },
  { sourceAccount, builderOptions, stellarClient }
);
```

---

## Error handling

```typescript
import {
  BuilderValidationError,
  SimulationFailedError,
  SimulationExpiredError,
  TransactionSubmissionError,
  AncoreSdkError,
} from '@ancore/core-sdk';

async function safeSendPayment(params, deps) {
  try {
    return await sendPayment(params, deps);
  } catch (error) {
    if (error instanceof BuilderValidationError) {
      // Fix the call site — bad inputs
      console.error('Invalid payment params:', error.message);
      throw error;
    }

    if (error instanceof SimulationFailedError) {
      // Contract would revert — check params and account state
      console.error('Simulation failed:', error.diagnosticMessage);
      throw error;
    }

    if (error instanceof SimulationExpiredError) {
      // Ledger entry needs restoration — retry after restoring storage
      console.error('Simulation expired — restore ledger entry and retry.');
      throw error;
    }

    if (error instanceof TransactionSubmissionError) {
      // Network or signing failure
      console.error('Submission failed:', error.message);
      if (error.resultXdr) {
        console.error('Result XDR:', error.resultXdr);
      }
      throw error;
    }

    throw error;
  }
}
```

---

## Platform notes

### Extension wallet (`apps/extension-wallet`)

The extension wallet signs transactions via the background service:

```typescript
const signer = {
  sign: async (transactionXdr: string) => {
    return chrome.runtime.sendMessage({
      type: 'SIGN_TRANSACTION',
      transactionXdr,
    });
  },
};
```

### Mobile wallet (`apps/mobile-wallet`)

Use the secure keychain to sign:

```typescript
import { signTransaction } from '@/security/keychain';

const signer = {
  sign: (xdr: string) => signTransaction(xdr, accountPublicKey),
};
```

### Web dashboard (`apps/web-dashboard`)

For in-browser signing with a loaded keypair:

```typescript
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

const keypair = Keypair.fromSecret('S...');

const signer = {
  sign: (transactionXdr: string) => {
    const tx = TransactionBuilder.fromXDR(transactionXdr, NETWORK_PASSPHRASE);
    tx.sign(keypair);
    return tx.toXDR();
  },
};
```

---

## Full example (TypeScript)

```typescript
import { sendPayment, BuilderValidationError, TransactionSubmissionError } from '@ancore/core-sdk';
import { StellarClient } from '@ancore/stellar';
import { Server } from '@stellar/stellar-sdk/rpc';
import { Account } from '@stellar/stellar-sdk';

const NETWORK = 'Test SDF Network ; September 2015';
const RPC_URL = 'https://soroban-testnet.stellar.org';

async function run() {
  const server        = new Server(RPC_URL);
  const accountData   = await server.getAccount('G...SOURCE');
  const sourceAccount = new Account(accountData.id, accountData.sequence);
  const stellarClient = new StellarClient({ rpcUrl: RPC_URL });

  const signer = {
    sign: async (xdr: string) => myKeyManager.signTransaction(xdr),
  };

  try {
    const result = await sendPayment(
      { to: 'G...DEST', amount: '5.0000000', signer },
      {
        sourceAccount,
        builderOptions: { networkPassphrase: NETWORK, server, fee: '100' },
        stellarClient,
      }
    );
    console.log('Payment sent:', result.hash);
  } catch (err) {
    if (err instanceof BuilderValidationError) {
      console.error('Bad params:', err.message);
    } else if (err instanceof TransactionSubmissionError) {
      console.error('Submission failed:', err.message, err.resultXdr);
    } else {
      throw err;
    }
  }
}
```

---

## Related

- [SDK: `sendPayment`](../sdk-wrappers.md#sendpayment)
- [Session-key execute example](./session-key-execute.md)
