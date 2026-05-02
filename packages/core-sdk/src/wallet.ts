import {
  decryptSecretKey,
  deriveKeypairFromMnemonic,
  encryptSecretKey,
  generateMnemonic,
  validateMnemonic,
  type EncryptedSecretKeyPayload,
} from '@ancore/crypto';

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
}

export interface ImportWalletOptions {
  mnemonic: string;
  password?: string;
  accountIndex?: number;
}

export interface RestoreWalletOptions {
  encryptedMnemonic: EncryptedSecretKeyPayload;
  password: string;
  accountIndex?: number;
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

export function deriveContractId(publicKey: string): string {
  return `CAS${publicKey.slice(1, 56)}`;
}

async function buildWalletMaterial(
  mnemonic: string,
  password: string | undefined,
  accountIndex: number
): Promise<WalletMaterial> {
  const keypair = deriveKeypairFromMnemonic(mnemonic, accountIndex);
  const encryptedMnemonic =
    password === undefined ? undefined : await encryptSecretKey(mnemonic, password);

  return {
    mnemonic,
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
    accountIndex,
    contractId: deriveContractId(keypair.publicKey()),
    encryptedMnemonic,
  };
}

export async function createWallet(options: CreateWalletOptions = {}): Promise<WalletMaterial> {
  const mnemonic = generateMnemonic();
  const accountIndex = normalizeAccountIndex(options.accountIndex);

  return buildWalletMaterial(mnemonic, options.password, accountIndex);
}

export async function importWallet(options: ImportWalletOptions): Promise<WalletMaterial> {
  const mnemonic = normalizeMnemonic(options.mnemonic);
  const accountIndex = normalizeAccountIndex(options.accountIndex);

  return buildWalletMaterial(mnemonic, options.password, accountIndex);
}

export async function restoreWallet(options: RestoreWalletOptions): Promise<WalletMaterial> {
  const accountIndex = normalizeAccountIndex(options.accountIndex);
  const mnemonic = normalizeMnemonic(
    await decryptSecretKey(options.encryptedMnemonic, options.password)
  );

  return buildWalletMaterial(mnemonic, options.password, accountIndex);
}
