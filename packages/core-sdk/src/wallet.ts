import {
  decryptSecretKey,
  deriveKeypairFromMnemonic,
  encryptSecretKey,
  generateMnemonic,
  validateMnemonic,
  type EncryptedSecretKeyPayload,
} from '@ancore/crypto';
import type { Network } from '@ancore/types';
import { Address, hash, Networks, StrKey, xdr } from '@stellar/stellar-sdk';

export interface WalletMaterial {
  mnemonic: string;
  publicKey: string;
  secretKey: string;
  accountIndex: number;
  contractId: string;
  encryptedMnemonic?: EncryptedSecretKeyPayload;
}

export interface CreateWalletOptions {
  password?: string;
  accountIndex?: number;
  /** Network the derived contractId is computed for (default: 'testnet'). */
  network?: Network;
}

export interface ImportWalletOptions {
  mnemonic: string;
  password?: string;
  accountIndex?: number;
  /** Network the derived contractId is computed for (default: 'testnet'). */
  network?: Network;
}

export interface RestoreWalletOptions {
  encryptedMnemonic: EncryptedSecretKeyPayload;
  password: string;
  accountIndex?: number;
  /** Network the derived contractId is computed for (default: 'testnet'). */
  network?: Network;
}

function normalizeAccountIndex(accountIndex: number | undefined): number {
  const resolvedIndex = accountIndex ?? 0;

  if (!Number.isInteger(resolvedIndex) || resolvedIndex < 0) {
    throw new Error('accountIndex must be a non-negative integer.');
  }

  return resolvedIndex;
}

function normalizeMnemonic(mnemonic: string): string {
  const normalizedMnemonic = mnemonic.trim().replace(/\s+/g, ' ');

  if (!validateMnemonic(normalizedMnemonic)) {
    throw new Error('mnemonic must be a valid 12-word BIP39 phrase.');
  }

  return normalizedMnemonic;
}

const NETWORK_PASSPHRASES: Record<Network, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
  futurenet: Networks.FUTURENET,
  local: Networks.STANDALONE,
};

/**
 * Fixed salt for CREATE2-style deterministic account deployment.
 *
 * Every Ancore smart account is deployed with its own owner as the sole
 * `createCustomContract` deployer address, so the owner alone already makes
 * the resulting contract id unique per account — the salt only needs to be
 * *constant* (not secret, not per-user) to keep this derivation reproducible
 * offline, the same way for every account.
 */
export const ACCOUNT_CONTRACT_SALT: Buffer = Buffer.alloc(32, 0);

/**
 * Deterministic Soroban contract address for an Ancore smart account.
 *
 * Replicates the network's own address derivation — sha256 of a
 * `HashIdPreimage::ContractId` built from the network id and a
 * `ContractIdPreimage::FromAddress{ address: owner, salt }` — so the address
 * is computable offline, before the contract is ever deployed. That is what
 * lets onboarding show a receive address immediately and lets a later
 * `deployAccount()` call (apps/extension-wallet/src/services/deploy-account.ts)
 * know exactly where to deploy to.
 *
 * The previous implementation here re-encoded the owner's raw Ed25519
 * public-key bytes with the contract StrKey prefix — syntactically valid,
 * but bearing no relationship to where Soroban actually places a deployed
 * contract, so nothing deployed on-chain would ever be found at that address.
 * `deployAccount()` MUST use this exact same `ACCOUNT_CONTRACT_SALT` and the
 * owner as the `createCustomContract` deployer, or the two addresses diverge.
 */
export function deriveContractId(ownerPublicKey: string, network: Network = 'testnet'): string {
  const networkId = hash(Buffer.from(NETWORK_PASSPHRASES[network]));
  const deployerAddress = new Address(ownerPublicKey);

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: deployerAddress.toScAddress(),
          salt: ACCOUNT_CONTRACT_SALT,
        })
      ),
    })
  );

  return StrKey.encodeContract(hash(preimage.toXDR()));
}

async function buildWalletMaterial(
  mnemonic: string,
  password: string | undefined,
  accountIndex: number,
  network: Network
): Promise<WalletMaterial> {
  const keypair = deriveKeypairFromMnemonic(mnemonic, accountIndex);
  const encryptedMnemonic =
    password === undefined ? undefined : await encryptSecretKey(mnemonic, password);

  return {
    mnemonic,
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    accountIndex,
    contractId: deriveContractId(keypair.publicKey(), network),
    encryptedMnemonic,
  };
}

export async function createWallet(options: CreateWalletOptions = {}): Promise<WalletMaterial> {
  const mnemonic = generateMnemonic();
  const accountIndex = normalizeAccountIndex(options.accountIndex);

  return buildWalletMaterial(
    mnemonic,
    options.password,
    accountIndex,
    options.network ?? 'testnet'
  );
}

export async function importWallet(options: ImportWalletOptions): Promise<WalletMaterial> {
  const mnemonic = normalizeMnemonic(options.mnemonic);
  const accountIndex = normalizeAccountIndex(options.accountIndex);

  return buildWalletMaterial(
    mnemonic,
    options.password,
    accountIndex,
    options.network ?? 'testnet'
  );
}

export async function restoreWallet(options: RestoreWalletOptions): Promise<WalletMaterial> {
  const accountIndex = normalizeAccountIndex(options.accountIndex);
  const mnemonic = normalizeMnemonic(
    await decryptSecretKey(options.encryptedMnemonic, options.password)
  );

  return buildWalletMaterial(
    mnemonic,
    options.password,
    accountIndex,
    options.network ?? 'testnet'
  );
}
