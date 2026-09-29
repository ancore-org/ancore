/**
 * @ancore/core-sdk - AccountTransactionBuilder
 *
 * A high-level convenience wrapper around Stellar SDK's `TransactionBuilder`
 * that simplifies invoking Ancore's account abstraction smart-contract methods
 * (`add_session_key`, `revoke_session_key`, `execute`).
 *
 * **This is NOT a replacement for Stellar's TransactionBuilder.**
 * It delegates all low-level transaction construction to the Stellar SDK and
 * only adds thin convenience methods for our specific contract operations.
 *
 * Key features:
 * - Fluent (chainable) API mirroring Stellar SDK patterns
 * - Automatic Soroban simulation before `build()`
 * - Fee estimation from simulation results
 * - Passthrough for any standard Stellar operation via `.addOperation()`
 * - Actionable error messages for common failure modes
 */

import {
  Account,
  BASE_FEE,
  Contract,
  Memo,
  nativeToScVal,
  rpc,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import {
  toScAddress,
  toScBytesN32,
  toScPermissionsVec,
  toScU64,
  toScOption,
  toScAddressVec,
  toScI128,
  CallerIdentity,
  toScCallerIdentity,
  toScBytes,
} from './contract-params';

import { BuilderValidationError, SimulationExpiredError, SimulationFailedError } from './errors';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options accepted by the `AccountTransactionBuilder` constructor.
 * All fields that mirror Stellar SDK's `TransactionBuilder.Options` are
 * forwarded as-is.
 */
export interface AccountTransactionBuilderOptions {
  /** Stellar/Soroban RPC server instance. */
  server: rpc.Server;

  /** Contract ID (C…) of the deployed Ancore account contract. */
  accountContractId: string;

  /** Network passphrase (e.g. `Networks.TESTNET`). */
  networkPassphrase: string;

  /**
   * Base fee in stroops. Defaults to `BASE_FEE` (100 stroops).
   * Simulation may override this with a higher value.
   */
  fee?: string;

  /**
   * Transaction timeout in seconds. Defaults to 300 (5 minutes).
   */
  timeoutSeconds?: number;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export class AccountTransactionBuilder {
  // -- Internal Stellar SDK builder & helpers --------------------------------
  private readonly txBuilder: TransactionBuilder;
  private readonly server: rpc.Server;
  private readonly contract: Contract;
  private readonly timeoutSeconds: number;

  /** Track whether at least one operation has been added. */
  private operationCount = 0;

  /** Whether setTimeout has already been applied to the inner builder. */
  private timeoutApplied = false;

  /**
   * The raw transaction produced by the inner builder, cached between
   * `simulate()` and `build()`.
   *
   * `TransactionBuilder.build()` consumes a sequence number from the source
   * account every time it is called. Without this cache, the documented flow —
   * `simulate()` to estimate fees, then `build()` to get the transaction —
   * burned two sequence numbers and returned a transaction numbered one higher
   * than the account's next expected sequence, which the network rejects with
   * `tx_bad_seq`. Every additional `simulate()` made it worse.
   *
   * Invalidated by anything that changes what the transaction should contain.
   */
  private rawTransaction: Transaction | null = null;

  constructor(sourceAccount: Account, options: AccountTransactionBuilderOptions) {
    const {
      server,
      accountContractId,
      networkPassphrase,
      fee = BASE_FEE,
      timeoutSeconds = 300,
    } = options;

    if (!accountContractId) {
      throw new BuilderValidationError(
        'accountContractId is required. Provide the C… contract ID of your ' +
          'deployed Ancore account contract.'
      );
    }

    this.server = server;
    this.contract = new Contract(accountContractId);
    this.timeoutSeconds = timeoutSeconds;

    // Delegate to Stellar SDK's TransactionBuilder
    this.txBuilder = new TransactionBuilder(sourceAccount, {
      fee,
      networkPassphrase,
    });
  }

  // -----------------------------------------------------------------------
  // Convenience methods for Ancore account-abstraction contract operations
  // -----------------------------------------------------------------------

  /**
   * Add a session key to the smart account.
   *
   * Wraps a Soroban contract invocation for `add_session_key(BytesN<32>, u64, Vec<u32>, Option<Vec<Address>>, Option<i128>, Option<i128>, u64)`.
   *
   * @param publicKey   - G… address of the session key
   * @param expiresAt   - Expiration timestamp (unix seconds)
   * @param permissions - Permission enum values (see `SessionPermission`)
   * @param allowedContracts - Optional array of contract addresses (C…) that can be called
   * @param maxAmountPerCall - Optional maximum spend per call
   * @param cumulativeLimit - Optional maximum cumulative spend in window
   * @param spendWindowSeconds - Spend window duration in seconds (required if cumulativeLimit is set)
   * @returns `this` for chaining
   */
  addSessionKey(
    publicKey: string,
    expiresAt: number,
    permissions: number[],
    allowedContracts?: string[] | null,
    maxAmountPerCall?: number | string | bigint | null,
    cumulativeLimit?: number | string | bigint | null,
    spendWindowSeconds: number = 0
  ): this {
    const operation = this.contract.call(
      'add_session_key',
      toScBytesN32(publicKey),
      toScU64(expiresAt),
      toScPermissionsVec(permissions),
      toScOption(allowedContracts, toScAddressVec),
      toScOption(maxAmountPerCall, toScI128),
      toScOption(cumulativeLimit, toScI128),
      toScU64(spendWindowSeconds)
    );

    this.txBuilder.addOperation(operation);
    this.operationCount++;
    this.rawTransaction = null;
    return this;
  }

  /**
   * Revoke a session key from the smart account.
   *
   * Wraps a Soroban contract invocation for `revoke_session_key(BytesN<32>)`.
   *
   * @param publicKey - G… address of the session key to revoke
   * @returns `this` for chaining
   */
  revokeSessionKey(publicKey: string): this {
    const operation = this.contract.call('revoke_session_key', toScBytesN32(publicKey));

    this.txBuilder.addOperation(operation);
    this.operationCount++;
    this.rawTransaction = null;
    return this;
  }

  /**
   * Execute operations using the account contract.
   *
   * Wraps a Soroban contract invocation for `execute(CallerIdentity, Address, Symbol, Vec<Val>, u64, Option<BytesN<32>>, Option<BytesN<64>>, Option<Bytes>)`.
   *
   * @param caller - Caller identity (Owner, SessionKey, or Quorum)
   * @param to - Target contract address
   * @param functionName - Function to invoke on the target contract
   * @param args - Arguments for the function (as ScVals)
   * @param expectedNonce - Expected nonce for replay protection
   * @param sessionPubKey - Session key public key (for SessionKey caller only)
   * @param signature - Signature bytes (for SessionKey caller only)
   * @param signaturePayload - Signed payload (for SessionKey caller only)
   * @returns `this` for chaining
   */
  execute(
    caller: CallerIdentity,
    to: string,
    functionName: string,
    args: xdr.ScVal[],
    expectedNonce: number,
    sessionPubKey?: string | null,
    signature?: Uint8Array | null,
    signaturePayload?: Uint8Array | null
  ): this {
    // Build CallerIdentity ScVal
    let callerScVal: xdr.ScVal;
    if (caller === CallerIdentity.Owner) {
      callerScVal = toScCallerIdentity(CallerIdentity.Owner);
    } else if (caller === CallerIdentity.SessionKey && sessionPubKey) {
      callerScVal = toScCallerIdentity(CallerIdentity.SessionKey, toScBytesN32(sessionPubKey));
    } else {
      throw new Error('Invalid caller identity configuration');
    }

    const operation = this.contract.call(
      'execute',
      callerScVal,
      toScAddress(to),
      nativeToScVal(functionName, { type: 'symbol' }),
      xdr.ScVal.scvVec(args),
      toScU64(expectedNonce),
      toScOption(sessionPubKey, toScBytesN32),
      toScOption(signature, toScBytes),
      toScOption(signaturePayload, toScBytes)
    );

    this.txBuilder.addOperation(operation);
    this.operationCount++;
    this.rawTransaction = null;
    return this;
  }

  // -----------------------------------------------------------------------
  // Passthrough methods — delegate directly to Stellar SDK's builder
  // -----------------------------------------------------------------------

  /**
   * Add any standard Stellar or Soroban operation.
   *
   * Use this when you need to include an operation that isn't covered by the
   * convenience methods above.
   *
   * @param operation - A Stellar XDR operation
   * @returns `this` for chaining
   */
  addOperation(operation: xdr.Operation): this {
    this.txBuilder.addOperation(operation);
    this.operationCount++;
    this.rawTransaction = null;
    return this;
  }

  /**
   * Attach a memo to the transaction.
   * Delegates directly to `TransactionBuilder.addMemo()`.
   *
   * @param memo - A Stellar `Memo` instance
   * @returns `this` for chaining
   */
  addMemo(memo: Memo): this {
    this.txBuilder.addMemo(memo);
    this.rawTransaction = null;
    return this;
  }

  /**
   * Set a custom timeout for the transaction.
   * Overrides the `timeoutSeconds` set in the constructor.
   *
   * @param seconds - Timeout in seconds
   * @returns `this` for chaining
   */
  setTimeout(seconds: number): this {
    this.txBuilder.setTimeout(seconds);
    this.timeoutApplied = true;
    this.rawTransaction = null;
    return this;
  }

  // -----------------------------------------------------------------------
  // Simulation & build
  // -----------------------------------------------------------------------

  /**
   * Simulate the transaction against the Soroban RPC server.
   *
   * Soroban **requires** simulation before submission so the network can
   * compute resource footprints and fee estimates.
   *
   * @returns The raw simulation response from Soroban RPC
   */
  async simulate(): Promise<rpc.Api.SimulateTransactionResponse> {
    this.assertHasOperations();

    const tx = this.buildRawTransaction();
    return this.server.simulateTransaction(tx);
  }

  /**
   * Build the final `Transaction` ready for signing and submission.
   *
   * Internally this:
   * 1. Calls `simulate()` to obtain resource footprints & fee estimates.
   * 2. Verifies the simulation succeeded.
   * 3. Assembles the transaction with simulation data (via Stellar SDK's
   *    `assembleTransaction`).
   *
   * @returns A fully assembled `Transaction` with Soroban resource data
   * @throws {SimulationFailedError} if simulation reports an error
   * @throws {SimulationExpiredError} if the simulation result requires restoration
   * @throws {BuilderValidationError} if no operations have been added
   */
  async build(): Promise<Transaction> {
    this.assertHasOperations();

    const tx = this.buildRawTransaction();
    const simulation = await this.server.simulateTransaction(tx);

    // Handle simulation failure
    if (rpc.Api.isSimulationError(simulation)) {
      throw new SimulationFailedError(
        (simulation as rpc.Api.SimulateTransactionErrorResponse).error
      );
    }

    // Handle restore-required responses
    if (rpc.Api.isSimulationRestore(simulation)) {
      throw new SimulationExpiredError();
    }

    // Success – assemble with resource footprint & fee data
    if (rpc.Api.isSimulationSuccess(simulation)) {
      return rpc.assembleTransaction(tx, simulation).build();
    }

    // Fallback – should not happen, but guard defensively
    throw new SimulationFailedError(
      'Unexpected simulation response shape. Please check Soroban RPC health.'
    );
  }

  // -----------------------------------------------------------------------
  // Internals
  // -----------------------------------------------------------------------

  /**
   * Build the raw (un-simulated) transaction from the inner builder.
   * Ensures setTimeout is called exactly once.
   */
  private buildRawTransaction(): Transaction {
    if (this.rawTransaction) {
      return this.rawTransaction;
    }

    if (!this.timeoutApplied) {
      this.txBuilder.setTimeout(this.timeoutSeconds);
      this.timeoutApplied = true;
    }

    this.rawTransaction = this.txBuilder.build();
    return this.rawTransaction;
  }

  /** Throw if the caller hasn't added at least one operation. */
  private assertHasOperations(): void {
    if (this.operationCount === 0) {
      throw new BuilderValidationError(
        'Cannot simulate or build a transaction with zero operations. ' +
          'Use addSessionKey(), revokeSessionKey(), execute(), or addOperation() first.'
      );
    }
  }
}
