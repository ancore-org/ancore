import { useCallback } from 'react';
import { validateTransferPolicy, type TransferPolicy } from '@ancore/types';
import { useSettingsStore } from '../stores/settings';

export interface TransferPolicySettings {
  dailyLimit: number;
  stepUpThreshold: number;
}

export function useTransferPolicy() {
  const dailyTransferLimit = useSettingsStore((state) => state.dailyTransferLimit);
  const transferStepUpThreshold = useSettingsStore((state) => state.transferStepUpThreshold);
  const setDailyTransferLimit = useSettingsStore((state) => state.setDailyTransferLimit);
  const setTransferStepUpThreshold = useSettingsStore((state) => state.setTransferStepUpThreshold);

  const policy: TransferPolicy = {
    dailyLimit: dailyTransferLimit,
    stepUpThreshold: transferStepUpThreshold,
  };

  const validateTransfer = useCallback(
    (amount: number, todayTotal: number = 0) => {
      return validateTransferPolicy(amount, todayTotal, policy);
    },
    [policy]
  );

  const updateSettings = useCallback(
    (settings: Partial<TransferPolicySettings>) => {
      if (settings.dailyLimit !== undefined) {
        setDailyTransferLimit(settings.dailyLimit);
      }
      if (settings.stepUpThreshold !== undefined) {
        setTransferStepUpThreshold(settings.stepUpThreshold);
      }
    },
    [setDailyTransferLimit, setTransferStepUpThreshold]
  );

  return {
    policy,
    validateTransfer,
    updateSettings,
  };
}
