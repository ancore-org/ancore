export type TransactionStatus = 'confirmed' | 'pending' | 'submitting' | 'failed';

export type SignMethod = 'wallet-api' | 'relayer';

export interface AccountData {
  address: string;
  balance: number;
  status: 'active' | 'inactive';
  lastActivity: Date;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive';
  amount: number;
  timestamp: Date;
  status: TransactionStatus;
  counterparty: string;
  /** Stellar transaction hash (available after submission). */
  hash?: string;
  /** Estimated network fee in XLM. */
  estimatedFee?: string;
  /** Signing method used. */
  signMethod?: SignMethod;
  /** Error message when status is 'failed'. */
  error?: string;
}
