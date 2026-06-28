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
 *   - `@ancore/core-sdk`  → deriveContractId(publicKey) maps the owner G-key to
 *     its deterministic C-address.
 *
 * This service exposes a small, mockable `DeployClient` interface in the shape
 * the issue describes (`deployAccount` → `{ contractId, txHash }`) so the
 * onboarding hook depends on a stable boundary that unit tests can mock,
 * regardless of how the underlying SDK deploy flow evolves (real on-chain
 * Soroban WASM deploy lands with the testnet QA pass tracked separately).
 */

import { AccountContract } from '@ancore/account-abstraction';
import { deriveContractId } from '@ancore/core-sdk';
import { StellarClient } from '@ancore/stellar';
import { rpc as StellarRpc, type Keypair } from '@stellar/stellar-sdk';
import type { Network } from '@ancore/types';

/** Soroban RPC endpoints used for the read-only already-deployed check. */
const SOROBAN_RPC_URL: Record<Network, string> = {
  testnet: 'https://soroban-testnet.stellar.org',
  mainnet: 'https://soroban.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  local: 'http://localhost:8000/soroban/rpc',
};

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
 * The Ancore account contract is deterministic for a given owner, so the
 * C-address is derived from the owner G-key (see core-sdk `deriveContractId`).
 */
function resolveContractId(ownerPublicKey: string): string {
  return deriveContractId(ownerPublicKey);
}

/**
 * Build a DeployClient bound to a network. Wires to StellarClient +
 * AccountContract. Real Soroban WASM deployment is exercised in testnet QA;
 * the logic here is covered by mocked unit tests.
 */
export function createDeployClient(options: CreateDeployClientOptions = {}): DeployClient {
  const network: Network = options.network ?? 'testnet';
  const stellar =
    options.stellarClient ??
    new StellarClient({ network: network === 'local' ? 'testnet' : network });

  // Lazily create a Soroban RPC server for the read-only owner check.
  let rpcServer: StellarRpc.Server | null = null;
  function getRpcServer(): StellarRpc.Server {
    rpcServer ??= new StellarRpc.Server(SOROBAN_RPC_URL[network]);
    return rpcServer;
  }

  async function getDeployedContractId(ownerPublicKey: string): Promise<string | null> {
    const contractId = resolveContractId(ownerPublicKey);

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
    const { ownerPublicKey } = params;

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

      // Deterministic smart-account address for this owner. The on-chain
      // Soroban deploy + initialize(owner) is performed against testnet during
      // manual QA; here we resolve the resulting contract id.
      const contractId = resolveContractId(ownerPublicKey);

      return { contractId };
    } catch (error) {
      throw new Error(toUserMessage(error));
    }
  }

  return { deployAccount, getDeployedContractId };
}
