import React, { useState } from 'react';

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<void>;
}

export function UnlockScreen({ onUnlock }: UnlockScreenProps): JSX.Element {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onUnlock(password);
    } catch {
      setError('Incorrect password. Please try again.');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-[360px] flex-col items-center justify-center bg-slate-950 px-6 text-slate-50">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 text-3xl">
          🔒
        </div>
        <h1 className="text-xl font-semibold text-white">Wallet Locked</h1>
        <p className="mt-1 text-sm text-slate-400">Enter your password to unlock</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
        />

        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full rounded-2xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}
