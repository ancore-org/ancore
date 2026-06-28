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

export type Network = 'testnet' | 'mainnet' | 'futurenet' | 'local';

export interface NetworkConfig {
  network: Network;
  rpcUrl?: string;
  rpcUrls?: string[];
  networkPassphrase?: string;
}

// Re-exports and custom types for account abstraction
export * from './stellar';
export * from './smart-account';
export * from './session-key';
export * from './user-operation';
export * from './wallet';
export * from './transfer-policy';
export * from './guards';
export * from './schemas';
export * from './payment-request';
export * from './contacts';
export * from './scheduled-transfer';
export * from './statement';
export * from './handle-resolution';
export * from './invoice';
export * from './external-api';
