/**
 * Split-bill / group payment types for the web-dashboard.
 */

export type SplitBillStatus = 'open' | 'completed' | 'expired' | 'cancelled';
export type ParticipantStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface SplitBillParticipant {
  id: string;
  address: string;
  alias?: string;
  amount: string;
  assetCode: string;
  status: ParticipantStatus;
  paidAt?: number;
  failedReason?: string;
}

export interface SplitBill {
  id: string;
  title: string;
  creatorAddress: string;
  participants: SplitBillParticipant[];
  note?: string;
  status: SplitBillStatus;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSplitBillInput {
  title: string;
  creatorAddress: string;
  note?: string;
  ttlSeconds?: number;
  participants: Array<{
    address: string;
    alias?: string;
    amount: string;
    assetCode: string;
  }>;
}
