/**
 * sendPayment — build → sign → submit a Stellar payment via the Ancore account contract.
 *
 * Flow:
 *  1. Build a payment transaction using AccountTransactionBuilder (simulate + assemble).
 *  2. Sign the assembled transaction via the provided signer.
 *  3. Submit to the Stellar network via StellarClient.
 *  4. Return a typed TransactionResult.
 */

import { Account, Asset, Operation } from '@stellar/stellar-sdk';
import type { Transaction } from '@stellar/stellar-sdk';
import type { TransactionResult } from '@ancore/types';
import { StellarClient } from '@ancore/stellar';

import { AccountTransactionBuilder, type AccountTransactionBuilderOptions } from './account-transaction-builder';
import {
  AncoreSdkError,
  BuilderValidationError,
  TransactionSubmissionError,
  SimulationFailedError,
  SimulationExpiredError,
} from './errors';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Signer interface — can be a session key or a full account key.
 * Receives the transaction XDR and returns the signed XDR.
 */
export interface PaymentSigner {
  /** Sign the transaction envelope XDR and return the signed XDR string. */
  sign(transactionXdr: string): Promise<string> | string;
}

/** Inputs for a single payment. */
export interface SendPaymentParams {
  /** Destination Stellar address (G…). */
  to: string;
  /** Amount to send as a string (e.g. "10.5000000"). */
  amount: string;
  /**
   * Asset to send. Defaults to native XLM.
   * Pass `{ code: 'USDC', issuer: 'G...' }` for non-native assets.
   */
  asset?: { code: string; issuer: string } | 'native';
  /** Signer (session key or full key) used to sign the transaction. */
  signer: PaymentSigner;
}

/** Dependencies injected into sendPayment — makes unit testing straightforward. */
export interface SendPaymentDeps {
  /** Source account loaded from the network (provides sequence number). */
  sourceAccount: Account;
  /** Options forwarded to AccountTransactionBuilder. */
  builderOptions: AccountTransactionBuilderOptions;
  /** StellarClient used for network submission. */
  stellarClient: StellarClient;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Build, sign, and submit a payment transaction.
 *
 * @param params - Payment parameters (to, amount, asset, signer).
 * @param deps   - Injected dependencies (sourceAccount, builderOptions, stellarClient).
 * @returns      A typed `TransactionResult`.
 *
 * @throws {BuilderValidationError}      on invalid inputs.
 * @throws {SimulationFailedError}       if Soroban simulation fails.
 * @throws {SimulationExpiredError}      if simulation requires ledger restoration.
 * @throws {TransactionSubmissionError}  if network submission fails.
 */
export async function sendPayment(
  params: SendPaymentParams,
  deps: SendPaymentDeps
): Promise<TransactionResult> {
  validateSendPaymentParams(params);

  const asset = resolveAsset(params.asset);

  // 1. Build the payment operation
  const paymentOp = Operation.payment({
    destination: params.to,
    asset,
    amount: params.amount,
  });

  // 2. Build + simulate + assemble the transaction
  let builtTx: Transaction;
  try {
    const builder = new AccountTransactionBuilder(deps.sourceAccount, deps.builderOptions);
    builder.addOperation(paymentOp);
    builtTx = await builder.build();
  } catch (error) {
    if (error instanceof AncoreSdkError) throw error;
    throw new BuilderValidationError(
      `Failed to build payment transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 3. Sign the transaction
  let signedXdr: string;
  try {
    signedXdr = await params.signer.sign(builtTx.toXDR());
  } catch (error) {
    throw new TransactionSubmissionError(
      `Signing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // 4. Submit to the network
  try {
    const { TransactionBuilder: StellarTxBuilder } = await import('@stellar/stellar-sdk');
    const signedTx = StellarTxBuilder.fromXDR(
      signedXdr,
      deps.builderOptions.networkPassphrase
    ) as Transaction;

    const response = await deps.stellarClient.submitTransaction(signedTx);

    return {
      status: 'success',
      hash: response.hash,
      ledger: response.ledger,
      timestamp: Date.now(),
    };
  } catch (err) {
    if (err instanceof AncoreSdkError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown submission error';
    const xdr = (err as { resultXdr?: string }).resultXdr;
    throw new TransactionSubmissionError(msg, xdr);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateSendPaymentParams(params: SendPaymentParams): void {
  if (!params || typeof params !== 'object') {
    throw new BuilderValidationError('sendPayment requires a params object.');
  }
  if (typeof params.to !== 'string' || params.to.trim().length === 0) {
    throw new BuilderValidationError('sendPayment: "to" must be a non-empty Stellar address.');
  }
  if (typeof params.amount !== 'string' || params.amount.trim().length === 0) {
    throw new BuilderValidationError('sendPayment: "amount" must be a non-empty string.');
  }
  if (isNaN(parseFloat(params.amount)) || parseFloat(params.amount) <= 0) {
    throw new BuilderValidationError('sendPayment: "amount" must be a positive numeric string.');
  }
  if (!params.signer || typeof params.signer.sign !== 'function') {
    throw new BuilderValidationError('sendPayment: "signer" must implement the PaymentSigner interface.');
  }
}

function resolveAsset(asset: SendPaymentParams['asset']): Asset {
  if (!asset || asset === 'native') {
    return Asset.native();
  }
  return new Asset(asset.code, asset.issuer);
}
