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
  switch (score) {
    case 0:
      return 'bg-red-500';
    case 1:
      return 'bg-red-500';
    case 2:
      return 'bg-yellow-500';
    case 3:
      return 'bg-yellow-500';
    case 4:
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
}

/**
 * Get strength label based on score
 */
function getStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Good';
    case 4:
      return 'Strong';
    default:
      return '';
  }
}

/**
 * Get strength color for text based on score
 */
function getStrengthTextColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'text-red-600';
    case 2:
    case 3:
      return 'text-yellow-600';
    case 4:
      return 'text-green-600';
    default:
      return 'text-muted-foreground';
  }
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
    <div className="flex flex-col min-h-screen bg-background">
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
      <div className="flex-1 px-6 overflow-y-auto">
        {/* Title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-700/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Create Your Password</h1>
          <p className="text-sm text-muted-foreground">
            This password will be used to unlock your wallet. Make sure it's strong and memorable.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 pr-12 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
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
                      index <= strengthScore - 1 ? getStrengthColor(strengthScore) : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Requirements */}
          <div className="bg-card rounded-xl border border-border/50 p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Requirements
            </h4>
            {PASSWORD_REQUIREMENTS.map((req) => {
              const isMet = req.test(password);
              return (
                <div key={req.id} className="flex items-center gap-2">
                  {isMet ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <X className="w-4 h-4 text-gray-300" />
                  )}
                  <span className={`text-sm ${isMet ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {req.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Confirm Password Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className={`w-full px-4 py-3 pr-12 bg-card border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                  passwordsMismatch
                    ? 'border-red-500 bg-red-50'
                    : passwordsMatch
                      ? 'border-green-500 bg-green-50'
                      : 'border-border'
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
            {passwordsMismatch && <p className="text-xs text-red-600">Passwords do not match</p>}
            {passwordsMatch && <p className="text-xs text-green-600">Passwords match</p>}
          </div>

          {/* Error Message */}
          {localError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{localError}</p>
            </div>
          )}

          {/* Warning */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-900 font-medium mb-1">Can't recover your password</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                There is no password reset feature. If you forget your password, you'll need your
                recovery phrase to access your wallet.
              </p>
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="px-6 py-6 pb-8 bg-background border-t border-border/50">
        <button
          onClick={handleSubmit}
          disabled={!allRequirementsMet || !passwordsMatch}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 disabled:shadow-none active:scale-[0.98]"
        >
          Continue
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
