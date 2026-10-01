# Batching Multiple Session-Key Requests with AncoreClient

> Comprehensive cookbook demonstrating how to create, refresh, and revoke multiple session keys in a single atomic transaction using `AncoreClient` and the Ancore SDK.  
> References: [`session-key-lifecycle.md`](./session-key-lifecycle.md) · [`sdk-wrappers.md`](../sdk-wrappers.md) · [`contract-methods.md`](../contract-methods.md)  
> Last updated: 2026-10-01

---

## Overview

When setting up multi-agent automation, game bots, automated payment pipelines, or microservice architectures, an account owner often needs to provision multiple session keys simultaneously. 

Executing separate transactions for each session key incurs redundant base fees, increases network round-trips, and risks partial failure if an intermediate transaction fails.

By batching multiple session-key invocations into a single Stellar/Soroban transaction:
- **Atomicity:** All session keys are registered together or none are.
- **Gas & Fee Efficiency:** Single transaction envelope and single signature overhead from the account owner.
- **Atomic Role Provisioning:** Provision granular, least-privilege keys for different subsystems (e.g., payment bot + oracle updater) in one operation.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Single Atomic Soroban Transaction                   │
│                                                                         │
│  ┌─────────────────────────┐   ┌─────────────────────────┐              │
│  │ Op 1: add_session_key   │   │ Op 2: add_session_key   │   ...        │
│  │ Key: TradingBot         │   │ Key: PaymentBot         │              │
│  │ Scope: INVOKE_CONTRACT  │   │ Scope: SEND_PAYMENT     │              │
│  │ TTL: 12 Hours           │   │ TTL: 7 Days             │              │
│  └─────────────────────────┘   └─────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                     Signed once by Smart Account Owner
```

---

## Prerequisites

Install the required workspace packages and Stellar SDK:

```bash
pnpm add @ancore/core-sdk @ancore/account-abstraction @ancore/types @stellar/stellar-sdk
```

---

## 1. Generating Multiple Scoped Session Keys

First, generate independent keypairs for each bot, agent, or service:

```typescript
import { Keypair } from '@stellar/stellar-sdk';
import { SessionPermission } from '@ancore/types';

// 1. Trading Bot Key: restricted to contract invocations, expires in 6 hours
const tradingBotKeyPair = Keypair.random();
const tradingBotConfig = {
  publicKey: tradingBotKeyPair.publicKey(),
  permissions: [SessionPermission.INVOKE_CONTRACT],
  expiresAt: Math.floor(Date.now() / 1000) + 6 * 3600, // 6 hours (unix seconds)
  label: 'High-Frequency Trading Agent',
};

// 2. Subscription/Payment Bot Key: restricted to payments, expires in 30 days
const paymentBotKeyPair = Keypair.random();
const paymentBotConfig = {
  publicKey: paymentBotKeyPair.publicKey(),
  permissions: [SessionPermission.SEND_PAYMENT],
  expiresAt: Math.floor(Date.now() / 1000) + 30 * 86400, // 30 days (unix seconds)
  label: 'Subscription Recurring Payment Worker',
};

// 3. Analytics/Data Sync Key: restricted to data management, expires in 24 hours
const dataBotKeyPair = Keypair.random();
const dataBotConfig = {
  publicKey: dataBotKeyPair.publicKey(),
  permissions: [SessionPermission.MANAGE_DATA],
  expiresAt: Math.floor(Date.now() / 1000) + 24 * 3600, // 24 hours (unix seconds)
  label: 'Account Metadata Syncer',
};
```

> [!IMPORTANT]
> Contract expiration (`expiresAt`) must always be specified in **unix seconds** (not milliseconds).

---

## 2. Batching with `AccountTransactionBuilder` (Recommended)

`AccountTransactionBuilder` provides a high-level, chainable API that automatically handles Soroban simulation, fee estimation, and transaction assembly.

```typescript
import { AncoreClient, AccountTransactionBuilder } from '@ancore/core-sdk';
import { Account, Keypair, Networks, rpc } from '@stellar/stellar-sdk';

async function batchAddSessionKeysWithBuilder(
  ownerKeypair: Keypair,
  contractId: string,
  rpcUrl: string = 'https://soroban-testnet.stellar.org'
) {
  const server = new rpc.Server(rpcUrl);

  // Initialize AncoreClient
  const client = new AncoreClient({ accountContractId: contractId });

  // Load owner's Stellar account sequence
  const ownerAccount = await server.getAccount(ownerKeypair.publicKey());

  // Initialize AccountTransactionBuilder
  const builder = new AccountTransactionBuilder(
    new Account(ownerAccount.id, ownerAccount.sequence),
    {
      server,
      accountContractId: client.accountContractId,
      networkPassphrase: Networks.TESTNET,
      fee: '100',
    }
  );

  // Chain multiple session key additions
  builder
    .addSessionKey(
      tradingBotConfig.publicKey,
      tradingBotConfig.expiresAt,
      tradingBotConfig.permissions
    )
    .addSessionKey(
      paymentBotConfig.publicKey,
      paymentBotConfig.expiresAt,
      paymentBotConfig.permissions
    )
    .addSessionKey(
      dataBotConfig.publicKey,
      dataBotConfig.expiresAt,
      dataBotConfig.permissions
    );

  // Automatically simulate and build the assembled transaction
  console.log('Simulating and building batch transaction...');
  const transaction = await builder.build();

  // Sign with smart account owner keypair
  transaction.sign(ownerKeypair);

  // Submit to Stellar network
  const sendResponse = await server.sendTransaction(transaction);
  console.log('Batch transaction submitted. Hash:', sendResponse.hash);

  // Poll for completion
  let statusResponse = await server.getTransaction(sendResponse.hash);
  while (statusResponse.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    statusResponse = await server.getTransaction(sendResponse.hash);
  }

  if (statusResponse.status === rpc.Api.GetTransactionStatus.SUCCESS) {
    console.log('All 3 session keys successfully activated on-chain in one transaction!');
  } else {
    console.error('Batch transaction failed:', statusResponse);
  }
}
```

---

## 3. Batching with `AncoreClient` & Stellar SDK `TransactionBuilder`

If you are using custom transaction pipelines or combining session key additions with standard Stellar operations (such as trustlines or payments), you can use `AncoreClient` and `AccountContract` directly:

```typescript
import { AncoreClient } from '@ancore/core-sdk';
import { AccountContract } from '@ancore/account-abstraction';
import {
  Account,
  Keypair,
  Networks,
  TransactionBuilder,
  rpc,
} from '@stellar/stellar-sdk';

async function batchAddSessionKeysRaw(
  ownerKeypair: Keypair,
  contractId: string,
  rpcUrl: string = 'https://soroban-testnet.stellar.org'
) {
  const server = new rpc.Server(rpcUrl);
  const client = new AncoreClient({ accountContractId: contractId });
  const contract = new AccountContract(contractId);

  // 1. Build InvocationArgs for each session key using AncoreClient
  const tradingInvocation = client.addSessionKey({
    publicKey: tradingBotConfig.publicKey,
    permissions: tradingBotConfig.permissions,
    expiresAt: tradingBotConfig.expiresAt,
  });

  const paymentInvocation = client.addSessionKey({
    publicKey: paymentBotConfig.publicKey,
    permissions: paymentBotConfig.permissions,
    expiresAt: paymentBotConfig.expiresAt,
  });

  // 2. Fetch owner sequence
  const ownerAccount = await server.getAccount(ownerKeypair.publicKey());
  const txBuilder = new TransactionBuilder(
    new Account(ownerAccount.id, ownerAccount.sequence),
    {
      fee: '100',
      networkPassphrase: Networks.TESTNET,
    }
  ).setTimeout(300);

  // 3. Convert invocations to operations and add them to the transaction
  txBuilder.addOperation(contract.buildInvokeOperation(tradingInvocation));
  txBuilder.addOperation(contract.buildInvokeOperation(paymentInvocation));

  const rawTx = txBuilder.build();

  // 4. Simulate transaction to calculate footprints and Soroban resource fees
  const simulation = await server.simulateTransaction(rawTx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  // 5. Assemble transaction with simulation data
  const preparedTx = rpc.assembleTransaction(rawTx, simulation).build();

  // 6. Sign and submit
  preparedTx.sign(ownerKeypair);
  const result = await server.sendTransaction(preparedTx);
  console.log('Transaction hash:', result.hash);
}
```

---

## 4. Mixed Batch: Add, Refresh, and Revoke Keys Atomically

You can combine different session key lifecycle operations in a single atomic transaction:
- Add a new session key
- Refresh the persistent storage TTL of an active key (`refresh_session_key_ttl`)
- Revoke an old or compromised session key (`revoke_session_key`)

```typescript
import { AncoreClient, AccountTransactionBuilder } from '@ancore/core-sdk';
import { Account, Keypair, Networks, rpc } from '@stellar/stellar-sdk';
import { SessionPermission } from '@ancore/types';

async function atomicKeyRotation(
  ownerKeypair: Keypair,
  contractId: string,
  newSessionKeyPub: string,
  activeSessionKeyPub: string,
  oldSessionKeyPub: string,
  rpcServer: rpc.Server
) {
  const client = AncoreClient.createSmartAccount(ownerKeypair.publicKey(), {
    accountContractId: contractId,
  });

  const accountInfo = await rpcServer.getAccount(ownerKeypair.publicKey());
  const builder = new AccountTransactionBuilder(
    new Account(accountInfo.id, accountInfo.sequence),
    {
      server: rpcServer,
      accountContractId: client.accountContractId,
      networkPassphrase: Networks.TESTNET,
    }
  );

  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 86400;

  // 1. Add replacement key
  builder.addSessionKey(
    newSessionKeyPub,
    expiresAt,
    [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT]
  );

  // 2. Revoke old key
  builder.revokeSessionKey(oldSessionKeyPub);

  // Build, sign, and submit atomically
  const tx = await builder.build();
  tx.sign(ownerKeypair);
  const response = await rpcServer.sendTransaction(tx);
  console.log('Key rotation submitted:', response.hash);
}
```

---

## 5. Verifying Batched Session Keys On-Chain

After submitting the batch transaction, verify that each key exists with its configured permissions and expiration:

```typescript
import { AccountContract } from '@ancore/account-abstraction';
import { rpc, Networks } from '@stellar/stellar-sdk';

async function verifySessionKeys(
  contractId: string,
  publicKeys: string[],
  sourceAccount: string,
  rpcUrl: string = 'https://soroban-testnet.stellar.org'
) {
  const server = new rpc.Server(rpcUrl);
  const contract = new AccountContract(contractId);

  for (const pubKey of publicKeys) {
    const sessionKeyData = await contract.getSessionKey(pubKey, {
      server,
      sourceAccount,
      networkPassphrase: Networks.TESTNET,
    });

    if (sessionKeyData) {
      console.log(`Key ${pubKey}:`);
      console.log(`  Expires At (unix): ${sessionKeyData.expiresAt}`);
      console.log(`  Permissions: ${sessionKeyData.permissions.join(', ')}`);
    } else {
      console.warn(`Key ${pubKey} was not found on-chain.`);
    }
  }
}
```

---

## 6. Error Handling & Edge Cases

| Issue | Cause | Recovery / Prevention |
|---|---|---|
| `tx_bad_seq` | Sequence number consumed or out of sync | Use `AccountTransactionBuilder` which caches the raw transaction between `simulate()` and `build()`. |
| Simulation Error: `Error(Contract, #1)` | Contract panic during execution | Check if a public key in the batch has invalid format or duplicate entry. |
| Simulation Error: `Restoration required` | Account contract or storage entry expired | Restore persistent storage entries before executing state changes. |
| Expiration in past | `expiresAt` set to a timestamp `< current_ledger_time` | Always use `Math.floor(Date.now() / 1000) + delta_seconds`. |
| Max operations exceeded | Too many operations in a single Stellar transaction | Stellar supports up to 100 operations per transaction. Keep batches under 50 operations for optimal fees and footprint sizing. |

---

## Related Documentation

- [Session Key Lifecycle Cookbook](./session-key-lifecycle.md)
- [Session Key Execute Cookbook](./session-key-execute.md)
- [SDK Wrappers Reference](../sdk-wrappers.md)
- [Soroban Smart Account Contract Methods](../contract-methods.md)
