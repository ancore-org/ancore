/**
 * Shared TypeScript types for Ancore
 */

export interface Address {
  value: string;
}

export interface PublicKey {
  value: string;
}

export interface Signature {
  r: string;
  s: string;
  v: number;
}

export type Network = 'testnet' | 'mainnet' | 'local';

export interface NetworkConfig {
  network: Network;
  rpcUrl?: string;
  networkPassphrase?: string;
}

// Re-exports and custom types for account abstraction
export * from './stellar';
export * from './smart-account';
export * from './session-key';
export * from './user-operation';
export * from './wallet';
export * from './guards';
export * from './schemas';
