/**
 * splitBillStorage — pure localStorage helpers for split-bill management.
 * Follows the same pattern as contactsStorage.ts.
 */

import type {
  SplitBill,
  SplitBillParticipant,
  CreateSplitBillInput,
  ParticipantStatus,
} from '../types/split-bill';

export const SPLIT_BILL_STORAGE_KEY = 'ancore-dashboard-split-bills';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function loadSplitBills(): SplitBill[] {
  try {
    const raw = localStorage.getItem(SPLIT_BILL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SplitBill[];
  } catch {
    return [];
  }
}

export function saveSplitBills(bills: SplitBill[]): void {
  try {
    localStorage.setItem(SPLIT_BILL_STORAGE_KEY, JSON.stringify(bills));
  } catch {
    // localStorage unavailable
  }
}

export function createSplitBill(
  bills: SplitBill[],
  input: CreateSplitBillInput
): { updated: SplitBill[]; bill: SplitBill } {
  const now = Date.now();
  const ttl = (input.ttlSeconds ?? 86400) * 1000;

  const bill: SplitBill = {
    id: generateId(),
    title: input.title.trim(),
    creatorAddress: input.creatorAddress,
    note: input.note?.trim(),
    status: 'open',
    expiresAt: now + ttl,
    createdAt: now,
    updatedAt: now,
    participants: input.participants.map((p) => ({
      id: generateId(),
      address: p.address,
      alias: p.alias,
      amount: p.amount,
      assetCode: p.assetCode,
      status: 'pending' as ParticipantStatus,
    })),
  };

  return { updated: [...bills, bill], bill };
}

export function updateParticipantStatus(
  bills: SplitBill[],
  billId: string,
  participantId: string,
  status: ParticipantStatus,
  extra?: { failedReason?: string }
): SplitBill[] {
  return bills.map((bill) => {
    if (bill.id !== billId) return bill;

    const participants = bill.participants.map((p) =>
      p.id !== participantId
        ? p
        : {
            ...p,
            status,
            paidAt: status === 'paid' ? Date.now() : p.paidAt,
            failedReason: extra?.failedReason,
          }
    );

    const allPaid = participants.every((p) => p.status === 'paid');
    const updatedBill: SplitBill = {
      ...bill,
      participants,
      status: allPaid ? 'completed' : bill.status,
      updatedAt: Date.now(),
    };

    return updatedBill;
  });
}

export function cancelSplitBill(bills: SplitBill[], billId: string): SplitBill[] {
  return bills.map((b) =>
    b.id === billId ? { ...b, status: 'cancelled', updatedAt: Date.now() } : b
  );
}

/** Mark any open bills whose expiresAt has passed as expired. */
export function applyExpirations(bills: SplitBill[]): SplitBill[] {
  const now = Date.now();
  return bills.map((b) => {
    if (b.status !== 'open' || b.expiresAt > now) return b;
    return {
      ...b,
      status: 'expired',
      updatedAt: now,
      participants: b.participants.map((p) =>
        p.status === 'pending' ? { ...p, status: 'expired' as ParticipantStatus } : p
      ),
    };
  });
}
