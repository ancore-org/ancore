import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { amountSchema, isStellarAddress } from '@ancore/ui-kit';

export type SendStep = 'form' | 'review' | 'confirm' | 'status';
export type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface SendFormValues {
  to: string;
  amount: string;
}

export interface FeeEstimate {
  baseFee: string;
  totalFee: string;
  network: 'mainnet' | 'testnet' | 'futurenet';
}

export interface SendTransactionDraft extends SendFormValues {
  fee: FeeEstimate;
  total: string;
}

export interface SendService {
  estimateFee: (input: SendFormValues) => Promise<FeeEstimate>;
  authenticatePassword: (password: string) => Promise<boolean>;
  signTransaction: (tx: SendTransactionDraft) => Promise<string>;
  submitTransaction: (signedPayload: string) => Promise<{ txId: string }>;
  fetchTransactionStatus: (txId: string) => Promise<TxStatus>;
}

export interface UseSendTransactionOptions {
  balance?: number;
  service?: SendService;
  pollIntervalMs?: number;
}

export interface ValidationErrors {
  to?: string;
  amount?: string;
  password?: string;
  simulation?: string;
}

const DEFAULT_BALANCE = 250;
const DEFAULT_POLL_MS = 1000;

function createDefaultService(): SendService {
  return {
    estimateFee: async () => ({
      baseFee: '0.0000100',
      totalFee: '0.0000100',
      network: 'testnet',
    }),
    authenticatePassword: async (password: string) => password === 'wallet-password',
    signTransaction: async (tx: SendTransactionDraft) =>
      `signed:${tx.to}:${tx.amount}:${Date.now()}`,
    submitTransaction: async () => ({ txId: `tx_${Date.now()}` }),
    fetchTransactionStatus: async () => 'confirmed',
  };
}

export function validateRecipientAddress(value: string): string | undefined {
  if (!value.trim()) {
    return 'Recipient address is required';
  }

  if (!isStellarAddress(value.trim())) {
    return 'Invalid Stellar address';
  }

  return undefined;
}

export function validateAmount(value: string, balance: number): string | undefined {
  const parsed = amountSchema.safeParse(value);

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid amount';
  }

  const numeric = Number(value);

  if (numeric > balance) {
    return 'Insufficient balance';
  }

  return undefined;
}

export function useSendTransaction(options: UseSendTransactionOptions = {}) {
  const balance = options.balance ?? DEFAULT_BALANCE;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const service = useMemo(() => options.service ?? createDefaultService(), [options.service]);

  const [step, setStep] = useState<SendStep>('form');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [fee, setFee] = useState<FeeEstimate | null>(null);
  const [tx, setTx] = useState<SendTransactionDraft | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const validateForm = useCallback(
    (values: SendFormValues): boolean => {
      const nextErrors: ValidationErrors = {
        to: validateRecipientAddress(values.to),
        amount: validateAmount(values.amount, balance),
      };

      setErrors(nextErrors);
      return !nextErrors.to && !nextErrors.amount;
    },
    [balance]
  );

  const goToReview = useCallback(
    async (values: SendFormValues) => {
      if (!validateForm(values)) {
        return false;
      }

      setSubmitting(true);
      setErrors((current) => ({ ...current, simulation: undefined }));

      try {
        const estimatedFee = await service.estimateFee(values);
        const total = (Number(values.amount) + Number(estimatedFee.totalFee)).toFixed(7);

        setFee(estimatedFee);
        setTx({ ...values, fee: estimatedFee, total });
        setStep('review');
        return true;
      } catch (error) {
        console.error('Simulation failed:', error);
        const msg = error instanceof Error ? error.message : 'Simulation failed';
        setErrors((current) => ({ ...current, simulation: msg }));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [service, validateForm]
  );

  const requestConfirm = useCallback(() => {
    setStep('confirm');
  }, []);

  const confirmAndSubmit = useCallback(
    async (password: string) => {
      setErrors((current) => ({ ...current, password: undefined }));
      setSubmitting(true);

      try {
        const isValidPassword = await service.authenticatePassword(password);

        if (!isValidPassword) {
          setErrors((current) => ({ ...current, password: 'Incorrect password' }));
          return;
        }

        if (!tx) {
          setErrors((current) => ({ ...current, password: 'No transaction to submit' }));
          return;
        }

        const signed = await service.signTransaction(tx);
        const submission = await service.submitTransaction(signed);

        setTxId(submission.txId);
        setStatus('pending');
        setStep('status');

        pollRef.current = setInterval(async () => {
          const next = await service.fetchTransactionStatus(submission.txId);
          setStatus(next);

          if (next === 'confirmed' || next === 'failed') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
            }
          }
        }, pollIntervalMs);
      } finally {
        setSubmitting(false);
      }
    },
    [pollIntervalMs, service, tx]
  );

  const setMaxAmount = useCallback(() => {
    setErrors((current) => ({ ...current, amount: undefined }));
  }, []);

  return {
    balance,
    step,
    status,
    fee,
    tx,
    txId,
    errors,
    submitting,
    setStep,
    setErrors,
    goToReview,
    requestConfirm,
    confirmAndSubmit,
    setMaxAmount,
  };
}
