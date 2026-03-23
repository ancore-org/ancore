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
  rpc,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';

import { toScAddress, toScOperationsVec, toScPermissionsVec, toScU64 } from './contract-params';

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
   * Wraps a Soroban contract invocation for `add_session_key(address, Vec<u32>, u64)`.
   *
   * @param publicKey   - G… address of the session key
   * @param permissions - Permission enum values (see `SessionPermission`)
   * @param expiresAt   - Expiration timestamp (unix ms)
   * @returns `this` for chaining
   */
  addSessionKey(publicKey: string, permissions: number[], expiresAt: number): this {
    const operation = this.contract.call(
      'add_session_key',
      toScAddress(publicKey),
      toScPermissionsVec(permissions),
      toScU64(expiresAt)
    );

    this.txBuilder.addOperation(operation);
    this.operationCount++;
    return this;
  }

  /**
   * Revoke a session key from the smart account.
   *
   * Wraps a Soroban contract invocation for `revoke_session_key(address)`.
   *
   * @param publicKey - G… address of the session key to revoke
   * @returns `this` for chaining
   */
  revokeSessionKey(publicKey: string): this {
    const operation = this.contract.call('revoke_session_key', toScAddress(publicKey));

    this.txBuilder.addOperation(operation);
    this.operationCount++;
    return this;
  }

  /**
   * Execute operations using a session key.
   *
   * Wraps a Soroban contract invocation for `execute(address, Vec<bytes>)`.
   *
   * @param sessionKeyPublicKey - G… address of the session key authorising this execution
   * @param operations          - Array of Stellar XDR operations to execute
   * @returns `this` for chaining
   */
  execute(sessionKeyPublicKey: string, operations: xdr.Operation[]): this {
    const operation = this.contract.call(
      'execute',
      toScAddress(sessionKeyPublicKey),
      toScOperationsVec(operations)
    );

    this.txBuilder.addOperation(operation);
    this.operationCount++;
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
    if (!this.timeoutApplied) {
      this.txBuilder.setTimeout(this.timeoutSeconds);
      this.timeoutApplied = true;
    }
    return this.txBuilder.build();
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
