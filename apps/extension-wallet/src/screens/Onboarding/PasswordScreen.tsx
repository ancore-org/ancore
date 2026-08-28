import * as React from 'react';
import { Eye, EyeOff, Check, X, ChevronRight, Lock, AlertTriangle } from 'lucide-react';

/**
 * PasswordScreen props
 */
export interface PasswordScreenProps {
  onSubmit: (password: string) => void;
  onBack: () => void;
  checkStrength?: (password: string) => { isValid: boolean; score: number; feedback: string[] };
}

interface PasswordRequirements {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/**
 * Password requirements
 */
const PASSWORD_REQUIREMENTS: PasswordRequirements[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (p) => p.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'number',
    label: 'One number',
    test: (p) => /[0-9]/.test(p),
  },
  {
    id: 'special',
    label: 'One special character',
    test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
  },
];

/**
 * Get strength color based on score
 */
function getStrengthColor(score: number): string {
  if (score <= 2) return 'bg-destructive';
  if (score <= 4) return 'bg-warning';
  return 'bg-success';
}

/**
 * Get strength label based on score
 */
function getStrengthLabel(score: number): string {
  if (score <= 2) return 'Very Weak';
  if (score === 3) return 'Fair';
  if (score === 4) return 'Good';
  return 'Strong';
}

/**
 * Get strength color for text based on score
 */
function getStrengthTextColor(score: number): string {
  if (score <= 2) return 'text-destructive';
  if (score <= 4) return 'text-warning';
  return 'text-success';
}

/**
 * PasswordScreen - Creates a password for the wallet
 *
 * Allows users to create a strong password with real-time
 * validation and strength feedback.
 */
export function PasswordScreen({ onSubmit, onBack }: PasswordScreenProps) {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Calculate password strength
  const strengthScore = React.useMemo(() => {
    const passedRequirements = PASSWORD_REQUIREMENTS.filter((req) => req.test(password)).length;
    return passedRequirements;
  }, [password]);

  const allRequirementsMet = strengthScore === PASSWORD_REQUIREMENTS.length;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setLocalError(null);

      if (!allRequirementsMet) {
        setLocalError('Please meet all password requirements');
        return;
      }

      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }

      onSubmit(password);
    },
    [allRequirementsMet, password, confirmPassword, onSubmit]
  );

  return (
    <div className="wallet-sheet">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6">
        {/* Title */}
        <div className="mb-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-accent">
            <Lock className="h-5 w-5 text-foreground" />
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-foreground">
            Create your password
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This password will be used to unlock your wallet. Make sure it's strong and memorable.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password Input */}
          <div className="space-y-2">
            <label htmlFor="password-input" className="text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="wallet-field pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Strength Indicator */}
          {password.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Strength</span>
                <span className={`text-xs font-medium ${getStrengthTextColor(strengthScore)}`}>
                  {getStrengthLabel(strengthScore)}
                </span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className={`h-1.5 flex-1 rounded-full transition-all ${
                      index <= strengthScore - 1 ? getStrengthColor(strengthScore) : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          <div className="wallet-card space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Requirements
            </h4>
            {PASSWORD_REQUIREMENTS.map((req) => {
              const isMet = req.test(password);
              return (
                <div key={req.id} className="flex items-center gap-2">
                  {isMet ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span
                    className={`text-sm ${isMet ? 'text-foreground' : 'text-muted-foreground'}`}
                  >
                    {req.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-2">
            <label htmlFor="confirm-password-input" className="text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirm-password-input"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className={`wallet-field pr-12 ${
                  passwordsMismatch ? 'border-destructive' : passwordsMatch ? 'border-success' : ''
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordsMismatch && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
            {passwordsMatch && <p className="text-xs text-success">Passwords match</p>}
          </div>

          {/* Error Message */}
          {localError && (
            <div className="wallet-status-error flex items-start gap-3 rounded-xl border p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{localError}</p>
            </div>
          )}

          {/* Warning */}
          <div className="wallet-status-warning flex items-start gap-3 rounded-xl border p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">
                Can't recover your password
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                There is no password reset feature. If you forget your password, you'll need your
                recovery phrase to access your wallet.
              </p>
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-background px-6 pb-8 pt-6">
        <button
          onClick={handleSubmit}
          disabled={!allRequirementsMet || !passwordsMatch}
          className="wallet-pill-btn"
        >
          Continue
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
