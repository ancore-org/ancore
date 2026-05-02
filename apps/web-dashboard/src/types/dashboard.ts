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
  status: 'confirmed' | 'pending';
  counterparty: string;
}
