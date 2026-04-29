import { useEffect, useRef, useState } from 'react';

type Props = {
  onSubmit: (password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export const PasswordFallbackForm = ({ onSubmit, isLoading, error }: Props) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim().length === 0 || isLoading) return;
    onSubmit(password);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="unlock-password">Password</label>
      <div>
        <input
          ref={inputRef}
          id="unlock-password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={isLoading}
          aria-describedby={error ? 'unlock-password-error' : undefined}
          aria-invalid={error ? true : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      {error && (
        <p id="unlock-password-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" disabled={isLoading || password.trim().length === 0}>
        {isLoading ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  );
};