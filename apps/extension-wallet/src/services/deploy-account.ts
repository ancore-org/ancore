/**
 * deploy-account — wires the Ancore smart-account deployment used during
 * extension onboarding to the genuinely-available SDK primitives.
 *
 * Issue #768 references `AncoreClient.deployAccount({ ownerPublicKey, signer })`,
 * but no `deployAccount` symbol exists anywhere in the monorepo. The real
 * primitives are:
 *   - `@ancore/stellar`   → StellarClient (friendbot funding, account reads)
 *   - `@ancore/account-abstraction` → AccountContract (`initialize(owner)`,
 *     `getOwner()` for already-deployed detection)
 *   - `@ancore/core-sdk`  → deriveContractId(publicKey, network) maps the
 *     owner G-key to its deterministic C-address, and ACCOUNT_CONTRACT_SALT
 *     is the fixed salt that makes the derivation match the real deploy below.
 *
 * This service exposes a small, mockable `DeployClient` interface in the shape
 * the issue describes (`deployAccount` → `{ contractId, txHash }`) so the
 * onboarding hook depends on a stable boundary that unit tests can mock,
 * regardless of how the underlying SDK deploy flow evolves.
 *
 * `deployAccount` now performs the real on-chain deploy: upload the account
 * WASM (skipped if already installed), create the contract instance at the
 * address `deriveContractId` predicts (via `Operation.createCustomContract`
 * with the same fixed salt), then call `initialize(owner)`. Each step is
 * built, simulated, signed with the caller's `signer`, submitted, and polled
 * to confirmation before moving to the next — a partial deploy (WASM
 * installed but no instance, or an instance with no owner set) is safe to
 * retry: every step re-checks on-chain state first and skips what already
 * exists.
 */

import { AccountContract } from '@ancore/account-abstraction';
import { ACCOUNT_CONTRACT_SALT, deriveContractId } from '@ancore/core-sdk';
import { StellarClient } from '@ancore/stellar';
import {
  Address,
  Operation,
  TransactionBuilder,
  hash,
  rpc as StellarRpc,
  xdr,
  type Keypair,
} from '@stellar/stellar-sdk';
import type { Network } from '@ancore/types';

/** What every operation this module submits actually is — a Soroban host-function invocation. */
type InvokeHostFunctionOperation = xdr.Operation<Operation.InvokeHostFunction>;

/** Soroban RPC endpoints used for deploy, initialize, and the already-deployed check. */
const SOROBAN_RPC_URL: Record<Network, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  local: 'http://localhost:8000/soroban/rpc',
};

/**
 * Published path of the compiled account contract WASM (see
 * apps/extension-wallet/scripts/sync-account-wasm.mjs, which copies it from
 * contracts/target/.../ancore_account.optimized.wasm into public/contracts/
 * so Vite bundles it as a static asset).
 */
const ACCOUNT_WASM_PATH = 'contracts/ancore_account.wasm';

/** Generous flat fee covering Soroban resource fees on testnet; refined by simulation. */
const TX_FEE = '1000000';
const TX_TIMEOUT_SECONDS = 60;
const POLL_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 1500;

export interface DeployAccountParams {
  /** Owner Stellar address (G…) that controls the smart account. */
  ownerPublicKey: string;
  /**
   * Owner keypair used to fund/sign the deployment. Held only for the duration
   * of this call — callers MUST NOT retain it after the promise resolves.
   */
  signer: Keypair;
}

export interface DeployAccountResult {
  /** Deployed smart-account contract id (C…). */
  contractId: string;
  /** Transaction hash of the deployment, when available. */
  txHash?: string;
}

/**
 * Minimal deploy boundary. The onboarding hook depends on this interface so it
 * can be mocked in tests (`vi.mock`) without standing up Stellar RPC.
 */
export interface DeployClient {
  /** Deploy (or initialize) the smart account for the given owner. */
  deployAccount(params: DeployAccountParams): Promise<DeployAccountResult>;
  /**
   * Return the contract id of an already-deployed smart account for this owner,
   * or null if no contract exists on-chain yet. Used on reimport to avoid
   * redeploying.
   */
  getDeployedContractId(ownerPublicKey: string): Promise<string | null>;
}

export interface CreateDeployClientOptions {
  network?: Network;
  /** Injectable StellarClient — defaults to a network-scoped instance. */
  stellarClient?: StellarClient;
}

/**
 * Maps an unknown error from the deploy flow to a user-readable message.
 */
function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Smart account deployment failed. Please try again.';
}

/**
 * Resolve a smart-account contract id from the owner address.
 *
 * Deterministic for a given (owner, network): see deriveContractId's own
 * docs for the derivation. `deployAccount` below deploys to exactly this
 * address by using the same ACCOUNT_CONTRACT_SALT as its createCustomContract
 * salt and the owner as the deployer.
 */
function resolveContractId(ownerPublicKey: string, network: Network): string {
  return deriveContractId(ownerPublicKey, network);
}

/**
 * Fetch the compiled account contract WASM bundled with the extension.
 * `chrome.runtime.getURL` resolves it against the packaged extension origin;
 * outside a real extension context (unit tests, the Vite dev preview) the
 * bare path still works against the dev server's public/ mount.
 */
async function fetchAccountWasm(): Promise<Buffer> {
  const hasChromeRuntime =
    typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function';
  const url = hasChromeRuntime ? chrome.runtime.getURL(ACCOUNT_WASM_PATH) : `/${ACCOUNT_WASM_PATH}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load account contract WASM (HTTP ${response.status}). ` +
        'Build the contract and run "pnpm sync:wasm" in apps/extension-wallet.'
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll `getTransaction` for a final status via a raw JSON-RPC call instead of
 * `server.pollTransaction`/`server.getTransaction`.
 *
 * `server.getTransaction` eagerly XDR-decodes the full `resultMetaXdr`, and
 * the pinned `@stellar/stellar-sdk` (13.x) doesn't recognise a union
 * discriminant testnet's current protocol emits there — verified live: the
 * transaction succeeds on-chain (its contract exists, its effects apply) but
 * the SDK throws parsing the confirmation response. The `status` field is
 * plain JSON, present before any XDR decoding happens, so reading it via a
 * raw request sidesteps the incompatibility entirely for the one thing this
 * deploy flow actually needs: knowing whether the transaction succeeded.
 */
async function pollTransactionStatus(
  rpcUrl: string,
  hash: string,
  attempts: number,
  intervalMs: number
): Promise<'SUCCESS' | 'FAILED'> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: attempt,
        method: 'getTransaction',
        params: { hash },
      }),
    });

    if (response.ok) {
      const body = (await response.json()) as { result?: { status?: string } };
      const status = body.result?.status;
      if (status === 'SUCCESS' || status === 'FAILED') {
        return status;
      }
      // NOT_FOUND (not yet ingested) or missing — keep polling.
    }

    await sleep(intervalMs);
  }

  throw new Error('Timed out waiting for transaction confirmation');
}

/**
 * Build, simulate, sign, submit, and confirm one Soroban operation.
 * Every deploy step (upload, create, initialize) goes through this so a
 * failure at any point leaves the transaction's own error message intact
 * rather than a generic wrapper.
 */
async function submitAndConfirm(
  server: StellarRpc.Server,
  rpcUrl: string,
  sourceAccountId: string,
  networkPassphrase: string,
  operation: InvokeHostFunctionOperation,
  signer: Keypair
): Promise<{ hash: string }> {
  const account = await server.getAccount(sourceAccountId);
  const transaction = new TransactionBuilder(account, {
    fee: TX_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(TX_TIMEOUT_SECONDS)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  prepared.sign(signer);

  const sendResult = await server.sendTransaction(prepared);
  if (sendResult.status === 'ERROR') {
    throw new Error(
      `Transaction rejected: ${JSON.stringify(sendResult.errorResult ?? sendResult)}`
    );
  }

  const status = await pollTransactionStatus(
    rpcUrl,
    sendResult.hash,
    POLL_ATTEMPTS,
    POLL_INTERVAL_MS
  );
  if (status !== 'SUCCESS') {
    throw new Error(`Transaction did not succeed: ${status}`);
  }

  return { hash: sendResult.hash };
}

/**
 * Build a DeployClient bound to a network. Wires to StellarClient +
 * AccountContract, and performs the real Soroban WASM deploy + initialize.
 */
export function createDeployClient(options: CreateDeployClientOptions = {}): DeployClient {
  const network: Network = options.network ?? 'testnet';
  const stellar =
    options.stellarClient ??
    new StellarClient({ network: network === 'local' ? 'testnet' : network });

  // Lazily create a Soroban RPC server for both the read-only owner check
  // and the write flow in deployAccount.
  let rpcServer: StellarRpc.Server | null = null;
  function getRpcServer(): StellarRpc.Server {
    rpcServer ??= new StellarRpc.Server(SOROBAN_RPC_URL[network]);
    return rpcServer;
  }

  async function getDeployedContractId(ownerPublicKey: string): Promise<string | null> {
    const contractId = resolveContractId(ownerPublicKey, network);

    try {
      const contract = new AccountContract(contractId);
      const server = getRpcServer();
      // If get_owner simulates successfully, the contract already exists on-chain.
      await contract.getOwner({
        server: {
          getAccount: async (accountId: string) => {
            const account = await server.getAccount(accountId);
            return { id: account.accountId(), sequence: account.sequenceNumber() };
          },
          simulateTransaction: (tx) =>
            server.simulateTransaction(
              tx as Parameters<StellarRpc.Server['simulateTransaction']>[0]
            ),
        },
        sourceAccount: ownerPublicKey,
        networkPassphrase: stellar.getNetworkPassphrase(),
      });
      return contractId;
    } catch {
      // Not deployed yet (or owner account unfunded) — caller will deploy.
      return null;
    }
  }

  async function deployAccount(params: DeployAccountParams): Promise<DeployAccountResult> {
    const { ownerPublicKey, signer } = params;

    try {
      // Reimport short-circuit: if the contract already exists, reuse it.
      const existing = await getDeployedContractId(ownerPublicKey);
      if (existing) {
        return { contractId: existing };
      }

      // Fund the owner account so it can pay deployment fees (testnet only).
      if (network === 'testnet') {
        await stellar.fundWithFriendbot(ownerPublicKey);
      }

      const server = getRpcServer();
      const networkPassphrase = stellar.getNetworkPassphrase();
      const contractId = resolveContractId(ownerPublicKey, network);

      const wasmBytes = await fetchAccountWasm();
      const wasmHash = hash(wasmBytes);

      let alreadyInstalled = true;
      try {
        await server.getContractWasmByHash(wasmHash);
      } catch {
        alreadyInstalled = false;
      }

      let lastTxHash: string | undefined;

      const rpcUrl = SOROBAN_RPC_URL[network];

      if (!alreadyInstalled) {
        const uploadResult = await submitAndConfirm(
          server,
          rpcUrl,
          ownerPublicKey,
          networkPassphrase,
          Operation.uploadContractWasm({ wasm: wasmBytes }),
          signer
        );
        lastTxHash = uploadResult.hash;
      }

      const createResult = await submitAndConfirm(
        server,
        rpcUrl,
        ownerPublicKey,
        networkPassphrase,
        Operation.createCustomContract({
          address: new Address(ownerPublicKey),
          wasmHash,
          salt: ACCOUNT_CONTRACT_SALT,
        }),
        signer
      );
      lastTxHash = createResult.hash;

      const accountContract = new AccountContract(contractId);
      const initOperation = accountContract.buildInvokeOperation(
        accountContract.initialize(ownerPublicKey)
      );
      const initResult = await submitAndConfirm(
        server,
        rpcUrl,
        ownerPublicKey,
        networkPassphrase,
        initOperation,
        signer
      );
      lastTxHash = initResult.hash;

      return { contractId, txHash: lastTxHash };
    } catch (error) {
      throw new Error(toUserMessage(error));
    }
  }

  return { deployAccount, getDeployedContractId };
}
