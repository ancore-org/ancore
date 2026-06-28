import React, { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { validateTransferPolicy } from '@ancore/types';
import type { TransferPolicy } from '@ancore/types';

interface SendFlowState {
  recipient: string;
  amount: string;
  memo: string;
  policyAction?: 'allow' | 'step_up' | 'block';
  policyMessage?: string;
  isLoading: boolean;
  error?: string;
  success?: boolean;
}

export const SendFlow: React.FC = () => {
  const [state, setState] = useState<SendFlowState>({
    recipient: '',
    amount: '',
    memo: '',
    isLoading: false,
  });

  const [userPolicy] = useState<TransferPolicy>({
    dailyLimit: 1000,
    stepUpThreshold: 250,
  });

  const [todayTotal] = useState(500); // Placeholder for actual transaction history

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const amount = e.target.value;
      setState((prev) => ({
        ...prev,
        amount,
      }));

      // Validate transfer policy in real-time
      if (amount && !isNaN(Number(amount))) {
        const numeric = Number(amount);
        const result = validateTransferPolicy(numeric, todayTotal, userPolicy);
        setState((prev) => ({
          ...prev,
          policyAction: result.action as any,
          policyMessage: result.message,
        }));
      }
    },
    [userPolicy, todayTotal]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (state.policyAction === 'block') {
        setState((prev) => ({
          ...prev,
          error: 'Transfer exceeds daily limit. Please reduce the amount.',
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: undefined }));

      try {
        // Simulate API call to relayer
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setState((prev) => ({
          ...prev,
          isLoading: false,
          success: true,
          recipient: '',
          amount: '',
          memo: '',
        }));

        // Reset success message after 3 seconds
        setTimeout(() => {
          setState((prev) => ({ ...prev, success: undefined }));
        }, 3000);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Transfer failed',
        }));
      }
    },
    [state.policyAction]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h1 className="text-2xl font-bold">Send Transfer</h1>
          <p className="text-blue-100 text-sm mt-2">Send funds with daily transfer limits</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Success Message */}
          {state.success && (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-green-900">Transfer Successful</strong>
                <p className="text-sm text-green-700 mt-1">Your transfer has been sent</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {state.error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-red-900">Error</strong>
                <p className="text-sm text-red-700 mt-1">{state.error}</p>
              </div>
            </div>
          )}

          {/* Recipient Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              name="recipient"
              value={state.recipient}
              onChange={handleInputChange}
              placeholder="stellar address or public key"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Amount Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (XLM)</label>
            <input
              type="number"
              name="amount"
              value={state.amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              Today's total: {todayTotal} XLM / Daily limit: {userPolicy.dailyLimit} XLM
            </p>
          </div>

          {/* Step-up Warning */}
          {state.policyAction === 'step_up' && state.policyMessage && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-900 text-sm uppercase tracking-wide">
                  Verification Required
                </strong>
                <p className="text-sm text-amber-700 mt-1">{state.policyMessage}</p>
              </div>
            </div>
          )}

          {/* Memo Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Memo (Optional)</label>
            <textarea
              name="memo"
              value={state.memo}
              onChange={handleInputChange}
              placeholder="Add a note for this transfer..."
              rows={3}
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
                {state.policyAction === 'block' && <span className="text-red-600">Blocked</span>}
                {state.policyAction === 'step_up' && (
                  <span className="text-amber-600">Requires Verification</span>
                )}
                {state.policyAction === 'allow' && <span className="text-green-600">Allowed</span>}
                {!state.policyAction && <span className="text-gray-600">Enter amount</span>}
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
            disabled={
              state.isLoading || state.policyAction === 'block' || !state.recipient || !state.amount
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            {state.isLoading ? (
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
