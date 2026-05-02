export interface WalletState {
  address: string | null;
  balance: number;
  assets: Record<string, number>;
}

export interface WalletActions {
  setWallet: (data: Partial<WalletState>) => void;
  resetWallet: () => void;
}
