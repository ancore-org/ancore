import { useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PasswordInput,
  Dialog,
  DialogContent,
} from '@ancore/ui-kit';
import type { SendTransactionDraft } from '@/hooks/useSendTransaction';
import { KeyRound, ArrowRight, ShieldCheck, Info } from 'lucide-react';

interface ConfirmDialogProps {
  transaction: SendTransactionDraft;
  timing?: 'immediate' | 'scheduled';
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
export function ConfirmDialog({
  transaction,
  timing,
  error,
  loading,
  onBack,
  onSign,
}: ConfirmDialogProps) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (password && !loading) {
      void onSign(password);
    }
  };

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
    >
      <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-md w-full">
        <Card className="w-full max-w-md overflow-hidden border border-border bg-card shadow-2xl">
          <CardHeader className="border-b border-border/70 bg-card pb-6">
            <CardTitle className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              Sign Transaction
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 pt-6 px-6 pb-8">
            <div className="text-center space-y-2">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">
                Authentication Required
              </p>
              <p className="text-sm text-slate-300 font-medium">
                {timing === 'scheduled' ? (
                  <>
                    Approving a scheduled transfer of{' '}
                    <span className="text-white font-black">{transaction.amount} XLM</span>
                  </>
                ) : (
                  <>
                    Sending <span className="text-white font-black">{transaction.amount} XLM</span>{' '}
                    to recipient
                  </>
                )}
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
                  className="h-14 rounded-2xl border-border bg-background text-foreground transition-colors focus:border-primary/60"
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
                  className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-full bg-white text-[11px] font-semibold text-black hover:bg-white/90 disabled:opacity-40"
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
      </DialogContent>
    </Dialog>
  );
}
