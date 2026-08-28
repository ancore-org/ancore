/**
 * Ledger WebHID signing adapter for Stellar.
 *
 * Signs classic G-address / smart-account *owner* operations on-device.
 * Session-key AA paths remain software-only unless a separate policy is designed.
 *
 * WebHID `requestDevice` requires a user gesture in a visible document
 * (extension popup / approval tab) — do not call from the MV3 service worker.
 */

import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import StellarApp from '@ledgerhq/hw-app-str';
import {
  Keypair,
  StrKey,
  TransactionBuilder,
  xdr,
  type FeeBumpTransaction,
  type Transaction,
} from '@stellar/stellar-sdk';

import { LedgerErrorCode, LedgerSigningError, mapLedgerError } from './ledger-errors';
import { stellarBip44Path, type SigningAdapter, type StellarBip44AccountIndex } from './types';

/** Minimal transport surface used by the adapter (real WebHID or test mock). */
export interface LedgerTransportLike {
  close(): Promise<void>;
}

export interface LedgerStellarAppLike {
  getAppConfiguration(): Promise<{ version: string; hashSigningEnabled?: boolean }>;
  getPublicKey(path: string, display?: boolean): Promise<{ rawPublicKey: Buffer }>;
  signTransaction(path: string, transaction: Buffer): Promise<{ signature: Buffer }>;
  signSorobanAuthorization?(path: string, authEntry: Buffer): Promise<{ signature: Buffer }>;
}

export interface LedgerTransportFactory {
  isSupported(): Promise<boolean>;
  create(): Promise<LedgerTransportLike>;
}

export interface LedgerSigningAdapterOptions {
  /** BIP-44 account index (`m/44'/148'/{n}'`). Default 0. */
  accountIndex?: StellarBip44AccountIndex;
  /** Override for tests — defaults to `@ledgerhq/hw-transport-webhid`. */
  transportFactory?: LedgerTransportFactory;
  /** Override for tests — receives an open transport. */
  createApp?: (transport: LedgerTransportLike) => LedgerStellarAppLike;
}

export interface LedgerPublicKeyResult {
  publicKey: string;
  rawPublicKey: Buffer;
  path: string;
  accountIndex: number;
}

export interface LedgerAppInfo {
  version: string;
  hashSigningEnabled: boolean;
}

const defaultTransportFactory: LedgerTransportFactory = {
  isSupported: () => TransportWebHID.isSupported(),
  create: () => TransportWebHID.create() as Promise<LedgerTransportLike>,
};

function defaultCreateApp(transport: LedgerTransportLike): LedgerStellarAppLike {
  return new StellarApp(transport as ConstructorParameters<typeof StellarApp>[0]);
}

function isFeeBump(tx: Transaction | FeeBumpTransaction): tx is FeeBumpTransaction {
  return (
    'innerTransaction' in tx && typeof (tx as FeeBumpTransaction).innerTransaction !== 'undefined'
  );
}

export class LedgerSigningAdapter implements SigningAdapter {
  private transport: LedgerTransportLike | null = null;
  private app: LedgerStellarAppLike | null = null;
  private readonly accountIndex: StellarBip44AccountIndex;
  private readonly transportFactory: LedgerTransportFactory;
  private readonly createApp: (transport: LedgerTransportLike) => LedgerStellarAppLike;

  constructor(options: LedgerSigningAdapterOptions = {}) {
    this.accountIndex = options.accountIndex ?? 0;
    this.transportFactory = options.transportFactory ?? defaultTransportFactory;
    this.createApp = options.createApp ?? defaultCreateApp;
  }

  get path(): string {
    return stellarBip44Path(this.accountIndex);
  }

  get derivationAccountIndex(): number {
    return this.accountIndex;
  }

  static async isSupported(
    factory: LedgerTransportFactory = defaultTransportFactory
  ): Promise<boolean> {
    try {
      return await factory.isSupported();
    } catch {
      return false;
    }
  }

  /** Open WebHID transport and verify the Stellar app responds. */
  async connect(): Promise<LedgerAppInfo> {
    try {
      const supported = await this.transportFactory.isSupported();
      if (!supported) {
        throw new LedgerSigningError(
          LedgerErrorCode.UNSUPPORTED,
          'WebHID is not available in this browser context'
        );
      }

      await this.disconnect();
      this.transport = await this.transportFactory.create();
      this.app = this.createApp(this.transport);
      return await this.getAppInfo();
    } catch (err) {
      await this.disconnect();
      throw mapLedgerError(err);
    }
  }

  /** Close the HID session and clear in-memory device handles. */
  async disconnect(): Promise<void> {
    const transport = this.transport;
    this.transport = null;
    this.app = null;
    if (transport) {
      try {
        await transport.close();
      } catch {
        // Ignore close failures — device may already be gone.
      }
    }
  }

  get isConnected(): boolean {
    return this.transport !== null && this.app !== null;
  }

  private async ensureApp(): Promise<LedgerStellarAppLike> {
    if (this.app && this.transport) {
      return this.app;
    }
    await this.connect();
    if (!this.app) {
      throw new LedgerSigningError(LedgerErrorCode.NOT_CONNECTED, 'No Ledger device connected');
    }
    return this.app;
  }

  async getAppInfo(): Promise<LedgerAppInfo> {
    const app = await this.ensureApp();
    try {
      const config = await app.getAppConfiguration();
      return {
        version: config.version,
        hashSigningEnabled: Boolean(config.hashSigningEnabled),
      };
    } catch (err) {
      throw mapLedgerError(err);
    }
  }

  /**
   * Read the G-address for the configured BIP-44 path.
   * When `display` is true, the device prompts the user to confirm the address.
   */
  async getPublicKey(display = false): Promise<LedgerPublicKeyResult> {
    const app = await this.ensureApp();
    try {
      const { rawPublicKey } = await app.getPublicKey(this.path, display);
      const publicKey = StrKey.encodeEd25519PublicKey(rawPublicKey);
      return {
        publicKey,
        rawPublicKey,
        path: this.path,
        accountIndex: this.accountIndex,
      };
    } catch (err) {
      throw mapLedgerError(err);
    }
  }

  /**
   * Sign an unsigned transaction envelope XDR on the device.
   * Returns a signed envelope XDR suitable for Horizon / relayer submit.
   */
  async sign(transactionXdr: string, networkPassphrase?: string): Promise<string> {
    const app = await this.ensureApp();
    try {
      const { publicKey } = await this.getPublicKey(false);
      const passphrase = networkPassphrase ?? inferNetworkPassphrase(transactionXdr);
      const tx = TransactionBuilder.fromXDR(transactionXdr, passphrase);
      const signatureBase = Buffer.from(tx.signatureBase());
      const { signature } = await app.signTransaction(this.path, signatureBase);
      return attachSignature(tx, publicKey, signature).toXDR();
    } catch (err) {
      throw mapLedgerError(err);
    }
  }

  /**
   * Sign a Soroban auth entry (SEP-46 / contract auth) when the Ledger app supports it.
   * Returns the raw 64-byte signature as base64.
   */
  async signAuthEntry(authEntryXdr: string): Promise<string> {
    const app = await this.ensureApp();
    if (typeof app.signSorobanAuthorization !== 'function') {
      throw new LedgerSigningError(
        LedgerErrorCode.UNSUPPORTED,
        'This Ledger Stellar app build does not support Soroban auth entry signing'
      );
    }
    try {
      const entry = Buffer.from(authEntryXdr, 'base64');
      const { signature } = await app.signSorobanAuthorization(this.path, entry);
      return signature.toString('base64');
    } catch (err) {
      throw mapLedgerError(err);
    }
  }
}

function attachSignature(
  tx: Transaction | FeeBumpTransaction,
  publicKey: string,
  signature: Buffer
): Transaction | FeeBumpTransaction {
  const hint = Keypair.fromPublicKey(publicKey).signatureHint();
  const decorated = new xdr.DecoratedSignature({
    hint,
    signature,
  });

  if (isFeeBump(tx)) {
    tx.signatures.push(decorated);
    return tx;
  }

  tx.signatures.push(decorated);
  return tx;
}

/**
 * Prefer an explicit passphrase from the caller. When missing, try common networks
 * so unit tests / callers that already baked the network into the XDR still work.
 */
function inferNetworkPassphrase(transactionXdr: string): string {
  const candidates = [
    'Test SDF Network ; September 2015',
    'Public Global Stellar Network ; September 2015',
    'Test SDF Future Network ; October 2022',
  ];
  for (const passphrase of candidates) {
    try {
      TransactionBuilder.fromXDR(transactionXdr, passphrase);
      return passphrase;
    } catch {
      // try next
    }
  }
  throw new LedgerSigningError(
    LedgerErrorCode.UNKNOWN,
    'Unable to decode transaction XDR — pass networkPassphrase explicitly'
  );
}

export { stellarBip44Path } from './types';
export type { SigningAdapter, StellarBip44AccountIndex } from './types';
export { LedgerErrorCode, LedgerSigningError, mapLedgerError } from './ledger-errors';
