# Soroban RPC Simulation Errors Troubleshooting

This guide covers common errors encountered when simulating Soroban smart account transactions via RPC, with actionable fixes and code examples.

## Overview

Transaction simulation is a critical step in building smart account transactions. The Soroban RPC `/simulate` endpoint validates transaction structure, resource usage, and contract execution before submission. This guide documents the most frequent simulation errors and how to resolve them.

## Common Simulation Errors

### 1. HostError (Contract Error)

**Error Pattern:**
```json
{
  "error": "HostError",
  "result": {
    "auth": [...],
    "events": [...],
    "latestLedger": 12345,
    "results": [
      {
        "xdr": "AAAAAQAAAAA=="
      }
    ],
    "error": {
      "error": "HostError",
      "message": "Error(Contract, #123)"
    }
  }
}
```

**Cause:** The contract execution failed during simulation. The error code `#123` is a contract-specific error (refer to your contract's error enum).

**Common Scenarios:**
- Invalid function arguments
- Contract invariant violations
- Authorization failures
- Insufficient balance for operations

**Fix:**
1. Parse the error code from the XDR result
2. Map it to your contract's error enum
3. Adjust the transaction parameters accordingly

```typescript
import { xdr } from '@stellar/stellar-sdk';

function parseContractError(simulationResult: any): string {
  if (simulationResult.error?.error === 'HostError') {
    const resultXdr = xdr.ScVal.fromXDR(simulationResult.results[0].xdr, 'base64');
    // Extract error code and map to contract error enum
    return `Contract error: ${resultXdr}`;
  }
  return 'Unknown error';
}
```

### 2. ResourceLimitExceeded / BudgetExceeded

**Error Pattern:**
```json
{
  "error": "ResourceLimitExceeded",
  "result": {
    "error": {
      "error": "ResourceLimitExceeded",
      "message": "Transaction resource limit exceeded: CPU instructions"
    }
  }
}
```

**Cause:** The transaction requires more CPU instructions or memory than the Soroban network allows per operation.

**Fix:** Increase the resource fee in the transaction:

```typescript
import { TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const transaction = new TransactionBuilder(sourceAccount, {
  fee: '10000', // Base fee
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(operation)
  .setTimeout(30)
  .build();

// Increase resource fee to 10,000 stroops (0.000001 XLM)
transaction.addResourceFee(10000);
```

**Best Practices:**
- Start with a reasonable resource fee (e.g., 10,000-100,000 stroops)
- Monitor simulation results to estimate actual resource usage
- Use resource sparing operations where possible

### 3. FootprintMismatch

**Error Pattern:**
```json
{
  "error": "FootprintMismatch",
  "result": {
    "error": {
      "error": "FootprintMismatch",
      "message": "Transaction footprint does not match simulated footprint"
    }
  }
}
```

**Cause:** The ledger access footprint (read/write set) in the transaction doesn't match what the simulation produced. This often happens when:
- The simulation result was not applied to the transaction
- Auth entries were not included after simulation
- Soroban resources were not updated

**Fix:** Always apply the simulation result to the transaction before submission:

```typescript
async function buildAndSubmitTransaction(account: Account, operation: Operation) {
  // 1. Build initial transaction
  const transaction = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // 2. Simulate the transaction
  const simulation = await server.simulateTransaction(transaction);

  if (simulation.error) {
    throw new Error(`Simulation failed: ${simulation.error}`);
  }

  // 3. Apply simulation result (critical step)
  const builtTransaction = TransactionBuilder.fromXDR(transaction.toXDR(), Networks.TESTNET);
  builtTransaction.setSorobanData(simulation.result);

  // 4. Sign and submit
  builtTransaction.sign(keypair);
  const result = await server.sendTransaction(builtTransaction);
  return result;
}
```

### 4. Missing Trustline

**Error Pattern:**
```json
{
  "error": "HostError",
  "result": {
    "error": {
      "error": "HostError",
      "message": "Error(Contract, #5)" // Common error code for trustline issues
    }
  }
}
```

**Cause:** The transaction attempts to use an asset (e.g., USDC) that the account does not have a trustline for.

**Fix:** Create a trustline before performing operations with the asset:

```typescript
import { Operation, Asset } from '@stellar/stellar-sdk';

// First, create a trustline transaction
const trustlineOp = Operation.changeTrust({
  asset: new Asset('USDC', 'issuerPublicKey'),
});

const trustlineTx = new TransactionBuilder(account, {
  fee: '10000',
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(trustlineOp)
  .setTimeout(30)
  .build();

trustlineTx.sign(keypair);
await server.sendTransaction(trustlineTx);

// Then proceed with the original transaction
```

### 5. AuthEntry Missing

**Error Pattern:**
```json
{
  "error": "HostError",
  "result": {
    "error": {
      "error": "HostError",
      "message": "Error(Auth, #1)"
    }
  }
}
```

**Cause:** The simulation returned auth entries that need to be signed, but they were not included in the final transaction.

**Fix:** Extract and sign auth entries from the simulation result:

```typescript
import { xdr } from '@stellar/stellar-sdk';

async function signWithAuthEntries(
  transaction: Transaction,
  simulationResult: any,
  keypair: Keypair
): Transaction {
  // Get auth entries from simulation
  const authEntries = simulationResult.result.auth;

  if (authEntries && authEntries.length > 0) {
    for (const entry of authEntries) {
      const authEntryXdr = xdr.SorobanAuthorizationEntry.fromXDR(entry, 'base64');
      // Sign the auth entry
      const signature = keypair.sign(authEntryXdr.hash());
      // Add signature to transaction
      transaction.addSignature(keypair.publicKey(), signature);
    }
  }

  return transaction;
}
```

## Debugging Workflow

When encountering a simulation error, follow this systematic approach:

1. **Inspect the full error response** - Check both `error.error` and `result.error` fields
2. **Parse XDR results** - Use Stellar SDK to decode any XDR fields for human-readable output
3. **Check the footprint** - Verify ledger access matches simulation
4. **Validate auth entries** - Ensure all required signatures are present
5. **Review resource usage** - Check if CPU/memory limits need adjustment
6. **Verify trustlines** - Confirm all assets have established trustlines

## Example: Complete Simulation Workflow

```typescript
import {
  TransactionBuilder,
  Networks,
  Server,
  Account,
  Keypair,
  Operation,
  xdr,
} from '@stellar/stellar-sdk';

async function executeSmartAccountTransaction(
  server: Server,
  account: Account,
  keypair: Keypair,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
) {
  // 1. Build contract invocation operation
  const operation = Operation.invokeHostFunction({
    func: xdr.HostFunction.invokeContract([
      new xdr.ScAddress(
        xdr.ScAddressType.scAddressTypeContract,
        Buffer.from(contractId, 'hex')
      ),
      new xdr.ScSymbol(functionName),
      ...args,
    ]),
  });

  // 2. Create transaction
  const transaction = new TransactionBuilder(account, {
    fee: '10000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  // 3. Simulate
  const simulation = await server.simulateTransaction(transaction);

  if (simulation.error) {
    console.error('Simulation error:', simulation.error);
    // Parse and handle specific error types
    if (simulation.error.error === 'HostError') {
      throw new Error(`Contract execution failed: ${simulation.error.message}`);
    } else if (simulation.error.error === 'ResourceLimitExceeded') {
      throw new Error('Resource limit exceeded - try increasing resource fee');
    }
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.error)}`);
  }

  // 4. Apply simulation result
  transaction.setSorobanData(simulation.result);

  // 5. Sign auth entries if present
  if (simulation.result.auth && simulation.result.auth.length > 0) {
    for (const authEntryBase64 of simulation.result.auth) {
      const authEntry = xdr.SorobanAuthorizationEntry.fromXDR(authEntryBase64, 'base64');
      const signature = keypair.sign(authEntry.hash());
      transaction.addSignature(keypair.publicKey(), signature);
    }
  }

  // 6. Sign transaction
  transaction.sign(keypair);

  // 7. Submit
  const result = await server.sendTransaction(transaction);
  console.log('Transaction submitted:', result.id);

  return result;
}
```

## Additional Resources

- [Soroban RPC Documentation](https://soroban.stellar.org/api/rpc)
- [Stellar SDK Transaction Simulation](https://stellar.github.io/js-stellar-sdk/TransactionBuilder.html#simulate)
- [Ancore Contract Methods](../../contract-methods.md)
- [Transaction Flow](../../architecture/TRANSACTION_FLOW.md)
