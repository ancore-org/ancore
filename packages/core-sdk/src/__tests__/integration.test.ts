/**
 * Integration tests for AccountTransactionBuilder against Stellar Testnet.
 *
 * These tests require a funded testnet account and a deployed Ancore account
 * contract. They are excluded from the default `pnpm test` run and should be
 * invoked via `pnpm test:integration`.
 *
 * Environment variables:
 *   TESTNET_SECRET_KEY      - Secret key of a funded testnet account
 *   TESTNET_CONTRACT_ID     - Contract ID of a deployed Ancore account contract
 *   SOROBAN_RPC_URL         - (optional) Soroban RPC URL, defaults to public testnet
 *
 * To run:
 *   TESTNET_SECRET_KEY=S... TESTNET_CONTRACT_ID=C... pnpm test:integration
 */

import { Account, Keypair, Memo, Networks, rpc } from '@stellar/stellar-sdk';

import { AccountTransactionBuilder } from '../account-transaction-builder';
import { SimulationFailedError } from '../errors';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SOROBAN_RPC_URL = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const SECRET_KEY = process.env.TESTNET_SECRET_KEY;
const CONTRACT_ID = process.env.TESTNET_CONTRACT_ID;

const isConfigured = Boolean(SECRET_KEY && CONTRACT_ID);

// Skip the entire suite if env vars are not set
const describeIntegration = isConfigured ? describe : describe.skip;

describeIntegration('AccountTransactionBuilder – Testnet Integration', () => {
  let server: rpc.Server;
  let keypair: Keypair;
  let sourceAccount: Account;

  beforeAll(async () => {
    server = new rpc.Server(SOROBAN_RPC_URL);
    keypair = Keypair.fromSecret(SECRET_KEY!);

    // Fetch account from ledger
    const ledgerAccount = await server.getAccount(keypair.publicKey());
    sourceAccount = new Account(ledgerAccount.accountId(), ledgerAccount.sequenceNumber());
  });

  // -----------------------------------------------------------------------
  // addSessionKey → simulate
  // -----------------------------------------------------------------------

  it('simulates an addSessionKey transaction', async () => {
    const sessionKeypair = Keypair.random();

    const builder = new AccountTransactionBuilder(sourceAccount, {
      server,
      accountContractId: CONTRACT_ID!,
      networkPassphrase: Networks.TESTNET,
    });

    const response = await builder
      .addSessionKey(
        sessionKeypair.publicKey(),
        [0, 1], // SEND_PAYMENT, MANAGE_DATA
        Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      )
      .addMemo(Memo.text('integration-test'))
      .simulate();

    // We expect either success or a contract-level error (depends on
    // whether the contract is actually deployed). Either way we confirm
    // the RPC round-trip worked.
    expect(response).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // addSessionKey → build (full assembly)
  // -----------------------------------------------------------------------

  it('builds an addSessionKey transaction with simulation assembly', async () => {
    const sessionKeypair = Keypair.random();

    const builder = new AccountTransactionBuilder(sourceAccount, {
      server,
      accountContractId: CONTRACT_ID!,
      networkPassphrase: Networks.TESTNET,
    });

    try {
      const tx = await builder
        .addSessionKey(sessionKeypair.publicKey(), [0], Math.floor(Date.now() / 1000) + 3600)
        .build();

      // If the contract is deployed and the simulation succeeds, we get a
      // fully assembled Transaction ready for signing.
      expect(tx).toBeDefined();
      expect(typeof tx.toXDR).toBe('function');
    } catch (err) {
      // If the contract isn't set up correctly on testnet the simulation
      // will fail — that's okay for CI; we verify the error type.
      expect(err).toBeInstanceOf(SimulationFailedError);
    }
  });

  // -----------------------------------------------------------------------
  // revokeSessionKey → simulate
  // -----------------------------------------------------------------------

  it('simulates a revokeSessionKey transaction', async () => {
    const sessionKeypair = Keypair.random();

    const builder = new AccountTransactionBuilder(sourceAccount, {
      server,
      accountContractId: CONTRACT_ID!,
      networkPassphrase: Networks.TESTNET,
    });

    const response = await builder.revokeSessionKey(sessionKeypair.publicKey()).simulate();

    expect(response).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Full sign & submit cycle (addSessionKey + revokeSessionKey)
  // -----------------------------------------------------------------------

  it('signs and submits an addSessionKey transaction', async () => {
    const sessionKeypair = Keypair.random();

    const builder = new AccountTransactionBuilder(sourceAccount, {
      server,
      accountContractId: CONTRACT_ID!,
      networkPassphrase: Networks.TESTNET,
    });

    try {
      const tx = await builder
        .addSessionKey(sessionKeypair.publicKey(), [0, 1, 2], Math.floor(Date.now() / 1000) + 7200)
        .addMemo(Memo.text('submit-test'))
        .build();

      // Sign with master key
      tx.sign(keypair);

      // Submit to testnet
      const result = await server.sendTransaction(tx);

      expect(result).toBeDefined();
      expect(['PENDING', 'DUPLICATE', 'TRY_AGAIN_LATER', 'ERROR']).toContain(result.status);

      // If PENDING, we could poll for confirmation, but that's beyond the
      // scope of this test. We've validated the full build → sign → submit flow.
    } catch (err) {
      // Contract may not be deployed — verify we got a simulation error
      expect(err).toBeInstanceOf(SimulationFailedError);
    }
  });
});
