import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { amountSchema, isStellarAddress, validateAmountPrecision } from '@ancore/ui-kit';
import {
  isUsernameHandle,
  normalizeUsernameHandle,
  type ResolvedHandle,
  type ScheduledTransfer,
  type UsernameHandle,
} from '@ancore/types';
import { mapRpcStatus, isTerminalStatus } from '@/utils/transaction-status';
import { validateTransferNote, truncateTransferNote } from '@/utils/note-validation';
import type { ScheduleConfig, TransferTiming } from '@/screens/Send/ScheduleControls';
import { validateSchedule } from '@/utils/schedule-validation';
import {
  buildDefaultRelayPayload,
  DEMO_ACCOUNT_ADDRESS,
  getExtensionSchedulerClient,
  toIsoStartAt,
  type SchedulerClient,
} from '@/services/scheduler-client';
import { resolveHandle as defaultResolveHandle } from '@/services/handle-resolver';
import type { SimulationState } from '@/screens/Send/SimulationPreview';

export type SendStep = 'form' | 'review' | 'confirm' | 'status' | 'scheduled';
export type TxStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface SendFormValues {
  to: string;
  amount: string;
  note?: string;
  timing?: TransferTiming;
  schedule?: ScheduleConfig;
}

export interface FeeEstimate {
  baseFee: string;
  totalFee: string;
  network: 'mainnet' | 'testnet' | 'futurenet';
}

export interface SendTransactionDraft extends SendFormValues {
  fee: FeeEstimate;
  total: string;
  truncatedNote?: string;
  recipientInput?: string;
  resolvedHandle?: ResolvedHandle;
}

export interface SimulationResult {
  simulatedFee: string;
  outcome: string;
}

export interface SendService {
  estimateFee: (input: SendFormValues) => Promise<FeeEstimate>;
  authenticatePassword: (password: string) => Promise<boolean>;
  resolveHandle?: (handle: UsernameHandle) => Promise<ResolvedHandle | null>;
  signTransaction: (tx: SendTransactionDraft) => Promise<string>;
  submitTransaction: (signedPayload: string) => Promise<{ txId: string }>;
  fetchTransactionStatus: (txId: string) => Promise<TxStatus>;
  simulateTransaction?: (tx: SendTransactionDraft) => Promise<SimulationResult>;
  createScheduledTransfer?: (
    tx: SendTransactionDraft,
    schedule: ScheduleConfig
  ) => Promise<ScheduledTransfer>;
}

export interface UseSendTransactionOptions {
  balance?: number;
  /** Maximum decimal places allowed for the asset being sent. Defaults to 7 (XLM). */
  assetDecimals?: number;
  service?: SendService;
  pollIntervalMs?: number;
  accountAddress?: string;
  schedulerClient?: SchedulerClient;
}

export interface ValidationErrors {
  to?: string;
  handle?: string;
  amount?: string;
  note?: string;
  password?: string;
  simulation?: string;
}

const DEFAULT_BALANCE = 250;
const DEFAULT_POLL_MS = 1000;

const HANDLE_NOT_FOUND_MESSAGE = 'Handle not found';

function isHandleInput(value: string): boolean {
  return value.trim().startsWith('@');
}

function createDefaultService(
  schedulerClient: SchedulerClient,
  accountAddress: string
): SendService {
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
    resolveHandle: defaultResolveHandle,
    createScheduledTransfer: async (tx, schedule) =>
      schedulerClient.createScheduledTransfer({
        accountAddress,
        to: tx.to,
        amount: tx.amount,
        asset: 'XLM',
        frequency: schedule.frequency,
        startAt: toIsoStartAt(schedule.startAt),
        endAt: schedule.endAt ? toIsoStartAt(schedule.endAt) : undefined,
        note: tx.truncatedNote,
        userApproved: true,
        relayPayload: buildDefaultRelayPayload(tx.to, tx.amount),
      }),
  };
}

export function validateRecipientAddress(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'Recipient address or @username is required';
  }

  if (isHandleInput(trimmed)) {
    return isUsernameHandle(trimmed) ? undefined : 'Enter a valid @username handle';
  }

  if (!isStellarAddress(trimmed)) {
    return 'Invalid Stellar address';
  }

  return undefined;
}

export function validateAmount(
  value: string,
  balance: number,
  assetDecimals: number = 7
): string | undefined {
  const parsed = amountSchema.safeParse(value);

  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Invalid amount';
  }

  const precisionError = validateAmountPrecision(value, assetDecimals);
  if (precisionError) {
    return precisionError;
  }

  const numeric = Number(value);

  if (numeric > balance) {
    return 'Insufficient balance';
  }

  return undefined;
}

export { validateSchedule } from '@/utils/schedule-validation';

export function useSendTransaction(options: UseSendTransactionOptions = {}) {
  const balance = options.balance ?? DEFAULT_BALANCE;
  const assetDecimals = options.assetDecimals ?? 7;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const accountAddress = options.accountAddress ?? DEMO_ACCOUNT_ADDRESS;
  const schedulerClient = useMemo(
    () => options.schedulerClient ?? getExtensionSchedulerClient(),
    [options.schedulerClient]
  );
  const service = useMemo(
    () => options.service ?? createDefaultService(schedulerClient, accountAddress),
    [accountAddress, options.service, schedulerClient]
  );

  const [step, setStep] = useState<SendStep>('form');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [fee, setFee] = useState<FeeEstimate | null>(null);
  const [tx, setTx] = useState<SendTransactionDraft | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [scheduledTransfer, setScheduledTransfer] = useState<ScheduledTransfer | null>(null);
  const [timing, setTiming] = useState<TransferTiming>('immediate');
  const [schedule, setSchedule] = useState<ScheduleConfig | undefined>();
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [simulation, setSimulation] = useState<SimulationState | undefined>();

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
        handle: undefined,
        amount: validateAmount(values.amount, balance, assetDecimals),
        note: values.note ? validateTransferNote(values.note) : undefined,
      };

      if (values.timing === 'scheduled') {
        const scheduleError = validateSchedule(values.schedule);
        if (scheduleError) {
          nextErrors.simulation = scheduleError;
        }
      } else {
        nextErrors.simulation = undefined;
      }

      setErrors(nextErrors);
      return !nextErrors.to && !nextErrors.amount && !nextErrors.note && !nextErrors.simulation;
    },
    [balance, assetDecimals]
  );

  const goToReview = useCallback(
    async (values: SendFormValues) => {
      setTiming(values.timing ?? 'immediate');
      setSchedule(values.schedule);

      if (!validateForm(values)) {
        return false;
      }

      setSubmitting(true);
      setErrors((current) => ({ ...current, simulation: undefined }));

      try {
        const recipientInput = values.to.trim();
        let resolvedHandle: ResolvedHandle | undefined;
        let resolvedValues = { ...values, to: recipientInput };

        if (isHandleInput(recipientInput)) {
          const resolver = service.resolveHandle ?? defaultResolveHandle;
          const handle = normalizeUsernameHandle(recipientInput);
          const resolved = await resolver(handle);

          if (!resolved) {
            setErrors((current) => ({
              ...current,
              to: HANDLE_NOT_FOUND_MESSAGE,
              handle: HANDLE_NOT_FOUND_MESSAGE,
            }));
            return false;
          }

          resolvedHandle = resolved;
          resolvedValues = { ...values, to: resolved.accountAddress };
        }

        const estimatedFee = await service.estimateFee(resolvedValues);
        const total = (Number(values.amount) + Number(estimatedFee.totalFee)).toFixed(7);
        const truncatedNote = values.note ? truncateTransferNote(values.note) : undefined;

        setFee(estimatedFee);
        setTx({
          ...resolvedValues,
          fee: estimatedFee,
          total,
          truncatedNote,
          recipientInput,
          resolvedHandle,
        });
        setStep('review');

        // Run simulation in the background after entering review
        if (service.simulateTransaction) {
          const draft: SendTransactionDraft = {
            ...resolvedValues,
            fee: estimatedFee,
            total,
            truncatedNote,
            recipientInput,
            resolvedHandle,
          };
          setSimulation({ status: 'loading' });
          service
            .simulateTransaction(draft)
            .then((result) => {
              setSimulation({
                status: 'success',
                simulatedFee: result.simulatedFee,
                outcome: result.outcome,
              });
            })
            .catch((err: unknown) => {
              const message =
                err instanceof Error ? err.message : 'Simulation failed';
              setSimulation({ status: 'error', message });
            });
        } else {
          setSimulation(undefined);
        }

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

        if (timing === 'scheduled') {
          if (!schedule) {
            setErrors((current) => ({ ...current, password: 'Schedule details are missing' }));
            return;
          }

          const createScheduled =
            service.createScheduledTransfer ??
            ((draft, scheduleConfig) =>
              schedulerClient.createScheduledTransfer({
                accountAddress,
                to: draft.to,
                amount: draft.amount,
                asset: 'XLM',
                frequency: scheduleConfig.frequency,
                startAt: toIsoStartAt(scheduleConfig.startAt),
                endAt: scheduleConfig.endAt ? toIsoStartAt(scheduleConfig.endAt) : undefined,
                note: draft.truncatedNote,
                userApproved: true,
                relayPayload: buildDefaultRelayPayload(draft.to, draft.amount),
              }));

          const created = await createScheduled(tx, schedule);
          setScheduledTransfer(created);
          setStep('scheduled');
          return;
        }

        const signed = await service.signTransaction(tx);
        const submission = await service.submitTransaction(signed);

        setTxId(submission.txId);
        setStatus('pending');
        setStep('status');

        pollRef.current = setInterval(async () => {
          const raw = await service.fetchTransactionStatus(submission.txId);
          const appStatus = mapRpcStatus(raw);
          setStatus(raw); // keep TxStatus in local state for hook consumers

          if (isTerminalStatus(appStatus)) {
            if (pollRef.current) {
              clearInterval(pollRef.current);
            }
          }
        }, pollIntervalMs);
      } finally {
        setSubmitting(false);
      }
    },
    [accountAddress, pollIntervalMs, schedule, schedulerClient, service, timing, tx]
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
    scheduledTransfer,
    timing,
    schedule,
    errors,
    submitting,
    simulation,
    setStep,
    setErrors,
    goToReview,
    requestConfirm,
    confirmAndSubmit,
    setMaxAmount,
  };
}
