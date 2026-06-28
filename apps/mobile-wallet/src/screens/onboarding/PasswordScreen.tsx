import { useState } from 'react';
import { validatePasswordStrength } from '@ancore/crypto';

type Props = {
  flow: 'create' | 'import';
  onBack?: () => void;
  onCancel?: () => void;
  onComplete?: (password: string) => Promise<void> | void;
};

const noop = () => {};

const STRENGTH_COLORS: Record<string, string> = {
  weak: 'bg-red-500',
  medium: 'bg-yellow-500',
  strong: 'bg-green-500',
};

const STRENGTH_LABELS: Record<string, string> = {
  weak: 'Weak',
  medium: 'Medium',
  strong: 'Strong',
};

export function PasswordScreen({ flow, onBack = noop, onCancel = noop, onComplete = noop }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordResult = validatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canContinue = passwordResult.valid && passwordsMatch && !submitting;

  const strength = passwordResult.valid
    ? passwordResult.strength
    : password.length > 0
      ? 'weak'
      : null;

  const handleContinue = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(password);
    } catch {
      setSubmitError('Failed to create wallet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label={flow === 'create' ? 'Set password' : 'Set password'} className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">
          {flow === 'create' ? 'Create' : 'Import'}
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">Set a password</h1>
        <p className="text-sm text-slate-600">This password unlocks your wallet on this device.</p>
      </header>

      <label className="block space-y-2 text-sm text-slate-700">
        <span>Password</span>
        <input
          aria-label="Password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter a strong password"
          type="password"
          value={password}
        />
      </label>

      {strength && (
        <div aria-label={`Password strength: ${strength}`} className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full ${STRENGTH_COLORS[strength]}`}
              style={{
                width: strength === 'weak' ? '33%' : strength === 'medium' ? '66%' : '100%',
              }}
            />
          </div>
          <p className="text-xs text-slate-500">{STRENGTH_LABELS[strength]}</p>
        </div>
      )}

      {password.length > 0 && !passwordResult.valid && (
        <ul
          aria-label="Password requirements"
          className="list-disc space-y-1 pl-5 text-xs text-red-600"
        >
          {passwordResult.reasons.map((reason: string, index: number) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}

      <label className="block space-y-2 text-sm text-slate-700">
        <span>Confirm password</span>
        <input
          aria-label="Confirm password"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter your password"
          type="password"
          value={confirmPassword}
        />
      </label>

      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className="text-xs text-red-600">Passwords do not match.</p>
      )}

      {submitError && (
        <p aria-live="polite" className="text-sm text-red-600" role="alert">
          {submitError}
        </p>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} type="button">
          Back
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
        <button disabled={!canContinue} onClick={handleContinue} type="button">
          {submitting ? 'Setting up...' : 'Continue'}
        </button>
      </div>
    </section>
  );
}
