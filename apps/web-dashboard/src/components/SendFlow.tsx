import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Radio,
  Shield,
  Wallet,
  XCircle,
} from 'lucide-react';
import { validateTransferPolicy } from '@ancore/types';
import type { TransferPolicy } from '@ancore/types';
import type { Transaction, SignMethod } from '../types/dashboard';
import type { SendStrategy } from '../services/send-service';
import { useSendTransaction } from '../hooks/useSendTransaction';
import { useSendFeeEstimate } from '../hooks/useSendFeeEstimate';
import { useWalletConnection } from '../hooks/useWalletConnection';

import { env } from '../lib/env';

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

const DEMO_MODE = env.VITE_DEMO_MODE === 'true';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendFlowState {
  recipient: string;
  amount: string;
  memo: string;
  policyAction?: 'allow' | 'step_up' | 'block';
  policyMessage?: string;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SigningMethodSelector({
  value,
  onChange,
  walletConnected,
  disabled,
}: {
  value: SignMethod;
  onChange: (method: SignMethod) => void;
  walletConnected: boolean;
  disabled: boolean;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 mb-2">Signing Method</legend>
      <div className="space-y-2">
        <label
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
            value === 'wallet-api'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Radio
            className={`w-4 h-4 ${value === 'wallet-api' ? 'text-blue-600' : 'text-gray-400'}`}
          />
          <Wallet className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sign via Extension</p>
            <p className="text-xs text-gray-500">
              {walletConnected
                ? 'Connected to Ancore extension'
                : 'Requires Ancore extension installed'}
            </p>
          </div>
          {walletConnected && <span className="text-xs text-green-600 font-medium">Connected</span>}
          <input
            type="radio"
            name="signMethod"
            value="wallet-api"
            checked={value === 'wallet-api'}
            onChange={() => onChange('wallet-api')}
            disabled={disabled}
            className="sr-only"
          />
        </label>

        <label
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
            value === 'relayer'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Radio className={`w-4 h-4 ${value === 'relayer' ? 'text-blue-600' : 'text-gray-400'}`} />
          <Shield className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Session Key Relay</p>
            <p className="text-xs text-gray-500">Submit via relayer with session key</p>
          </div>
          <input
            type="radio"
            name="signMethod"
            value="relayer"
            checked={value === 'relayer'}
            onChange={() => onChange('relayer')}
            disabled={disabled}
            className="sr-only"
          />
        </label>
      </div>
    </fieldset>
  );
}

function FeeDisplay({
  fee,
  minBalance,
  loading,
  error,
}: {
  fee: string;
  minBalance: string;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
          Estimated Fee
        </p>
        <p className="text-sm font-medium mt-1">
          {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <span>{fee} XLM</span>}
        </p>
        {error && <p className="text-xs text-amber-600 mt-1">{error}</p>}
      </div>
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">Min Balance</p>
        <p className="text-sm font-medium mt-1">{minBalance} XLM</p>
      </div>
    </div>
  );
}

function ConfirmationTimeline({ transaction }: { transaction: Transaction | null }) {
  if (!transaction) return null;

  const steps: Array<{
    label: string;
    status: 'done' | 'active' | 'pending' | 'error';
  }> = [
    {
      label: 'Transaction submitted',
      status:
        transaction.status === 'submitting'
          ? 'active'
          : transaction.status === 'pending' || transaction.status === 'confirmed'
            ? 'done'
            : transaction.status === 'failed'
              ? 'error'
              : 'pending',
    },
    {
      label: 'Sent to network',
      status:
        transaction.status === 'pending'
          ? 'active'
          : transaction.status === 'confirmed'
            ? 'done'
            : transaction.status === 'failed'
              ? 'error'
              : 'pending',
    },
    {
      label: 'Confirmed on-chain',
      status:
        transaction.status === 'confirmed'
          ? 'done'
          : transaction.status === 'failed'
            ? 'error'
            : 'pending',
    },
  ];

  const statusIcon = (s: string) => {
    switch (s) {
      case 'done':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'active':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 text-sm space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Transaction Status</p>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            transaction.status === 'confirmed'
              ? 'bg-green-100 text-green-700'
              : transaction.status === 'failed'
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
          }`}
        >
          {transaction.status}
        </span>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center gap-3">
            {statusIcon(step.status)}
            <span
              className={`text-sm ${
                step.status === 'done'
                  ? 'text-green-700'
                  : step.status === 'active'
                    ? 'text-blue-700 font-medium'
                    : step.status === 'error'
                      ? 'text-red-700'
                      : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {transaction.hash && (
        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">Transaction Hash</p>
          <p className="break-all font-mono text-xs">{transaction.hash}</p>
        </div>
      )}

      {transaction.error && (
        <div className="pt-2 border-t">
          <p className="text-xs text-red-600">{transaction.error}</p>
        </div>
      )}

      {transaction.signMethod && (
        <div className="flex items-center gap-1 pt-1">
          <Shield className="w-3 h-3 text-gray-400" />
          <span className="text-xs text-gray-500">
            Signed via {transaction.signMethod === 'wallet-api' ? 'Extension' : 'Session Key Relay'}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SendFlow: React.FC = () => {
  const [formState, setFormState] = useState<SendFlowState>({
    recipient: '',
    amount: '',
    memo: '',
  });

  const [signMethod, setSignMethod] = useState<SignMethod>('wallet-api');

  const [userPolicy] = useState<TransferPolicy>({
    dailyLimit: 1000,
    stepUpThreshold: 250,
  });

  const [todayTotal] = useState(0);

  // Wallet connection status
  const wallet = useWalletConnection();

  // Fee estimation (only when real mode)
  const feeEstimate = useSendFeeEstimate(formState.recipient, formState.amount, {
    disabled: DEMO_MODE || !formState.recipient || !formState.amount,
  });

  // Create send strategy
  const sendStrategy = useMemo<SendStrategy | null>(() => {
    if (DEMO_MODE) return null;
    // Strategy is created externally and passed via context in a real app.
    // For now, return null to use demo mode for both paths.
    // In production, this would come from a provider:
    //   return createSendStrategy(signMethod, { network: 'testnet' });
    return null;
  }, [signMethod]);

  const send = useSendTransaction({
    sendStrategy,
    demoMode: DEMO_MODE,
    network: 'testnet',
  });

  // Policy validation on amount change
  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const amount = e.target.value;
      setFormState((prev) => ({ ...prev, amount }));

      if (amount && !isNaN(Number(amount))) {
        const numeric = Number(amount);
        const result = validateTransferPolicy(numeric, todayTotal, userPolicy);
        setFormState((prev) => ({
          ...prev,
          policyAction: result.action as SendFlowState['policyAction'],
          policyMessage: result.message,
        }));
      } else {
        setFormState((prev) => ({
          ...prev,
          policyAction: undefined,
          policyMessage: undefined,
        }));
      }
    },
    [userPolicy, todayTotal]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (formState.policyAction === 'block') {
        return;
      }

      try {
        await send.sendTransaction({
          recipient: formState.recipient,
          amount: Number(formState.amount),
        });
      } catch {
        // Hook exposes errors via send.error
      }
    },
    [formState.policyAction, formState.recipient, formState.amount, send]
  );

  const isAmountInvalid = formState.policyAction === 'block';
  const amountDescriptionIds = [
    'send-amount-help',
    formState.policyMessage ? 'send-amount-policy-message' : null,
  ]
    .filter(Boolean)
    .join(' ');

  const isSubmitDisabled =
    send.loading || formState.policyAction === 'block' || !formState.recipient || !formState.amount;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Send Transfer</h1>
              <p className="text-blue-100 text-sm mt-2">
                {DEMO_MODE ? 'Demo mode — simulated transfers' : 'Send funds with real settlement'}
              </p>
            </div>
            {DEMO_MODE && (
              <span className="text-xs bg-amber-500/20 text-amber-100 px-2 py-1 rounded">DEMO</span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Wallet connection banner */}
          {!DEMO_MODE && !wallet.connected && signMethod === 'wallet-api' && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="text-amber-900">Extension not connected</strong>
                <p className="text-sm text-amber-700 mt-1">
                  Install and connect the Ancore Wallet extension to sign transactions, or switch to
                  Session Key Relay.
                </p>
              </div>
              <button
                type="button"
                onClick={wallet.connect}
                className="text-sm text-amber-800 underline hover:no-underline"
              >
                Connect
              </button>
            </div>
          )}

          {/* Success Message */}
          {send.optimisticTransaction?.status === 'confirmed' && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-green-900">Transfer Confirmed</strong>
                <p className="text-sm text-green-700 mt-1">
                  Your transfer has been confirmed on-chain.
                </p>
                {send.optimisticTransaction.hash && (
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${send.optimisticTransaction.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 underline inline-flex items-center gap-1 mt-1"
                  >
                    View on explorer <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {(send.error || send.optimisticTransaction?.status === 'failed') && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-red-900">Error</strong>
                <p className="text-sm text-red-700 mt-1">
                  {send.error?.message ?? send.optimisticTransaction?.error ?? 'Transfer failed'}
                </p>
              </div>
            </div>
          )}

          {/* Confirmation Timeline */}
          {send.optimisticTransaction && send.optimisticTransaction.status !== 'confirmed' && (
            <ConfirmationTimeline transaction={send.optimisticTransaction} />
          )}

          {/* Recipient Field */}
          <div>
            <label
              htmlFor="send-recipient"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Recipient Address
            </label>
            <input
              id="send-recipient"
              type="text"
              name="recipient"
              value={formState.recipient}
              onChange={handleInputChange}
              placeholder="Stellar address or @username"
              aria-label="Recipient address"
              aria-required="true"
              aria-invalid="false"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              required
            />
          </div>

          {/* Amount Field */}
          <div>
            <label htmlFor="send-amount" className="block text-sm font-medium text-gray-700 mb-2">
              Amount (XLM)
            </label>
            <input
              id="send-amount"
              type="number"
              name="amount"
              value={formState.amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              aria-label="Amount in XLM"
              aria-describedby={amountDescriptionIds}
              aria-invalid={isAmountInvalid}
              aria-required="true"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p id="send-amount-help" className="text-xs text-gray-500 mt-2">
              Today's total: {todayTotal} XLM / Daily limit: {userPolicy.dailyLimit} XLM
            </p>
          </div>

          {/* Policy Validation Message */}
          {formState.policyAction &&
            formState.policyAction !== 'allow' &&
            formState.policyMessage && (
              <div
                id="send-amount-policy-message"
                role={isAmountInvalid ? 'alert' : 'status'}
                className={`p-4 rounded-lg border flex items-start gap-3 ${
                  isAmountInvalid ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                }`}
              >
                <AlertCircle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    isAmountInvalid ? 'text-red-600' : 'text-amber-600'
                  }`}
                />
                <div>
                  <strong
                    className={`text-sm uppercase tracking-wide ${
                      isAmountInvalid ? 'text-red-900' : 'text-amber-900'
                    }`}
                  >
                    {isAmountInvalid ? 'Transfer Blocked' : 'Verification Required'}
                  </strong>
                  <p
                    className={`text-sm mt-1 ${isAmountInvalid ? 'text-red-700' : 'text-amber-700'}`}
                  >
                    {formState.policyMessage}
                  </p>
                </div>
              </div>
            )}

          {/* Signing Method (real mode only) */}
          {!DEMO_MODE && (
            <SigningMethodSelector
              value={signMethod}
              onChange={setSignMethod}
              walletConnected={wallet.connected}
              disabled={send.loading}
            />
          )}

          {/* Fee Display */}
          {!DEMO_MODE && formState.recipient && formState.amount && (
            <FeeDisplay
              fee={feeEstimate.fee}
              minBalance={feeEstimate.minBalance}
              loading={feeEstimate.loading}
              error={feeEstimate.error}
            />
          )}

          {/* Memo Field */}
          <div>
            <label htmlFor="send-memo" className="block text-sm font-medium text-gray-700 mb-2">
              Memo (Optional)
            </label>
            <textarea
              id="send-memo"
              name="memo"
              value={formState.memo}
              onChange={handleInputChange}
              placeholder="Add a note for this transfer..."
              rows={3}
              aria-label="Transfer memo"
              aria-required="false"
              aria-invalid="false"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Policy Status */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
                Policy Status
              </p>
              <p className="text-sm font-medium mt-1 capitalize">
                {formState.policyAction === 'block' && (
                  <span className="text-red-600">Blocked</span>
                )}
                {formState.policyAction === 'step_up' && (
                  <span className="text-amber-600">Requires Verification</span>
                )}
                {formState.policyAction === 'allow' && (
                  <span className="text-green-600">Allowed</span>
                )}
                {!formState.policyAction && <span className="text-gray-600">Enter amount</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
                Daily Remaining
              </p>
              <p className="text-sm font-medium mt-1">
                {Math.max(0, userPolicy.dailyLimit - todayTotal)} XLM
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {send.loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Transfer'
            )}
          </button>
        </form>
      </div>

      {/* Info Panel */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Transfer Limits</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Daily limit: {userPolicy.dailyLimit} XLM</li>
          <li>• Step-up threshold: {userPolicy.stepUpThreshold} XLM</li>
          <li>• Current today's total: {todayTotal} XLM</li>
          <li>• Remaining today: {Math.max(0, userPolicy.dailyLimit - todayTotal)} XLM</li>
        </ul>
      </div>
    </div>
  );
};

export default SendFlow;
