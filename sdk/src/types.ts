/**
 * Network configuration type
 */
export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
}

/**
 * Basic transaction type
 */
export interface Transaction {
  to: string;
  from: string;
  value: string;
  data?: string;
  nonce: number;
}
