import { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PasswordInput } from '@ancore/ui-kit';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';
import { KeyRound, ArrowRight, ShieldCheck, Info } from 'lucide-react';

interface ConfirmDialogProps {
  transaction: SendTransactionDraft;
  error?: string;
  loading?: boolean;
  onBack: () => void;
  onSign: (password: string) => Promise<void>;
}

/**
 * ConfirmDialog — The final authentication step where the user signs the transaction.
 *
 * Implements a secure-looking password entry field with high-contrast feedback.
 * Shows a summary of the action being authenticated.
 */
export function ConfirmDialog({ transaction, error, loading, onBack, onSign }: ConfirmDialogProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password && !loading) {
      void onSign(password);
    }
  };

  return (
    <Card className="w-full max-w-md bg-slate-950 border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 pb-6 border-b border-white/5">
        <CardTitle className="text-white uppercase tracking-widest text-xs flex items-center justify-center gap-2 font-black">
          <KeyRound className="text-amber-400 w-4 h-4" />
          Sign Transaction
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 px-6 pb-8">
        <div className="text-center space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
            Authentication Required
          </p>
          <p className="text-sm text-slate-300 font-medium">
            Sending <span className="text-white font-black">{transaction.amount} XLM</span> to
            recipient
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <PasswordInput
              label="Wallet Password"
              placeholder="Enter your password"
              value={password}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(event.target.value)
              }
              error={error}
              className="bg-white/5 border-white/10 text-white rounded-2xl h-14 focus:border-amber-400/50 transition-all"
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              className="flex-1 text-slate-500 hover:text-white hover:bg-white/5 rounded-2xl border border-white/5 h-12 text-[10px] font-black uppercase tracking-widest transition-all"
              onClick={onBack}
            >
              Go Back
            </Button>
            <Button
              type="submit"
              disabled={loading || !password}
              className="flex-[2] bg-amber-400 text-slate-950 font-black uppercase tracking-widest rounded-2xl h-12 shadow-[0_10px_20px_rgba(251,191,36,0.2)] hover:bg-amber-300 disabled:opacity-50 disabled:grayscale transition-all flex items-center justify-center gap-2 text-[10px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                  Signing...
                </span>
              ) : (
                <>
                  Sign & Submit
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="flex items-center justify-center gap-1.5 text-[8px] text-slate-700 uppercase tracking-widest font-black pt-2">
          <ShieldCheck className="w-3 h-3 opacity-50" />
          End-to-End Encrypted Authentication
        </div>
      </CardContent>
    </Card>
  );
}
