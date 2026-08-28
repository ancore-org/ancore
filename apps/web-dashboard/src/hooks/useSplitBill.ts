import { useState, useCallback, useEffect } from 'react';
import type { SplitBill, CreateSplitBillInput, ParticipantStatus } from '../types/split-bill';
import {
  loadSplitBills,
  saveSplitBills,
  createSplitBill as storageCreate,
  updateParticipantStatus as storageUpdateParticipant,
  cancelSplitBill as storageCancel,
  applyExpirations,
} from '../services/splitBillStorage';

export interface UseSplitBillReturn {
  bills: SplitBill[];
  isLoading: boolean;
  createBill: (input: CreateSplitBillInput) => SplitBill;
  updateParticipant: (
    billId: string,
    participantId: string,
    status: ParticipantStatus,
    extra?: { failedReason?: string }
  ) => void;
  cancelBill: (billId: string) => void;
  getBill: (billId: string) => SplitBill | undefined;
}

export function useSplitBill(): UseSplitBillReturn {
  const [bills, setBills] = useState<SplitBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loaded = applyExpirations(loadSplitBills());
    saveSplitBills(loaded);
    setBills(loaded);
    setIsLoading(false);
  }, []);

  const createBill = useCallback((input: CreateSplitBillInput): SplitBill => {
    const { updated, bill } = storageCreate(loadSplitBills(), input);
    saveSplitBills(updated);
    setBills(updated);
    return bill;
  }, []);

  const updateParticipant = useCallback(
    (
      billId: string,
      participantId: string,
      status: ParticipantStatus,
      extra?: { failedReason?: string }
    ) => {
      const updated = storageUpdateParticipant(
        loadSplitBills(),
        billId,
        participantId,
        status,
        extra
      );
      saveSplitBills(updated);
      setBills(updated);
    },
    []
  );

  const cancelBill = useCallback((billId: string) => {
    const updated = storageCancel(loadSplitBills(), billId);
    saveSplitBills(updated);
    setBills(updated);
  }, []);

  const getBill = useCallback((billId: string) => bills.find((b) => b.id === billId), [bills]);

  return { bills, isLoading, createBill, updateParticipant, cancelBill, getBill };
}
