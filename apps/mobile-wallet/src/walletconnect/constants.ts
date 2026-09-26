import type { Network } from '@ancore/types';

/** WalletConnect Stellar chain identifiers (CAIP-2 style). */
export const StellarRpcChains = {
  PUBLIC: 'stellar:pubnet',
  TESTNET: 'stellar:testnet',
} as const;

export type StellarRpcChain = (typeof StellarRpcChains)[keyof typeof StellarRpcChains];

/** Stellar JSON-RPC methods exposed to dApps over WalletConnect. */
export const STELLAR_NAMESPACE_METHODS = [
  'stellar_signXDR',
  'stellar_signAndSubmitXDR',
  'stellar_signMessage',
  'stellar_signAuthEntry',
] as const;

/** Stellar namespace events supported by the wallet. */
export const STELLAR_NAMESPACE_EVENTS = ['accountsChanged'] as const;

export interface WalletKitMetadataInput {
  name: string;
  description?: string;
  url?: string;
  icons?: string[];
  /** Native deep-link redirect scheme (defaults to `ancore://`). */
  redirectNative?: string;
}

export interface WalletKitMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
  redirect: {
    native: string;
  };
}

export const networkToStellarChain = (network: Network): StellarRpcChain => {
  if (network === 'mainnet') {
    return StellarRpcChains.PUBLIC;
  }

  return StellarRpcChains.TESTNET;
};

export const buildStellarAccountId = (chain: StellarRpcChain, publicKey: string): string =>
  `${chain}:${publicKey}`;

export const buildWalletKitMetadata = (input: WalletKitMetadataInput): WalletKitMetadata => ({
  name: input.name,
  description: input.description ?? 'Ancore Stellar wallet',
  url: input.url ?? 'https://ancore.dev',
  icons: input.icons ?? [],
  redirect: {
    native:
      input.redirectNative ??
      (typeof __DEV__ !== 'undefined' && __DEV__ ? 'ancoredev://' : 'ancore://'),
  },
});
