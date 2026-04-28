import { Badge, Card, CardContent, CardHeader, CardTitle, Button, cn } from '@ancore/ui-kit';
import type { TxStatus } from '@/hooks/useSendTransaction';
import { CheckCircle2, XCircle, Clock, ExternalLink, ArrowLeft, Info } from 'lucide-react';

interface StatusScreenProps {
  txId: string;
  status: TxStatus;
  onClose?: () => void;
}

const STATUS_CONFIG: Record<
  TxStatus,
  { label: string; color: string; icon: React.ReactNode; description: string }
> = {
  idle: {
    label: 'Initial',
    color: 'slate',
    icon: <Clock className="w-8 h-8 text-slate-500" />,
    description: 'Preparing transaction...',
  },
  pending: {
    label: 'Processing',
    color: 'cyan',
    icon: <Clock className="w-8 h-8 text-cyan-400 animate-spin-slow" />,
    description: 'Waiting for network confirmation. This usually takes 3-5 seconds.',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'emerald',
    icon: <CheckCircle2 className="w-8 h-8 text-emerald-400" />,
    description: 'Success! Your assets have been securely transferred.',
  },
  failed: {
    label: 'Failed',
    color: 'red',
    icon: <XCircle className="w-8 h-8 text-red-400" />,
    description: 'Transaction failed. This may be due to network congestion or invalid state.',
  },
};

/**
 * StatusScreen — Displays the result of the transaction submission.
 *
 * Implements a visually distinct feedback layout for success, failure, and pending states.
 */
export function StatusScreen({ txId, status, onClose }: StatusScreenProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Card className="w-full max-w-md bg-slate-950 border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <CardHeader
        className={cn(
          'pb-8 border-b border-white/5',
          status === 'confirmed' && 'bg-emerald-500/5',
          status === 'failed' && 'bg-red-500/5',
          status === 'pending' && 'bg-cyan-500/5'
        )}
      >
        <CardTitle className="text-white uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 font-black pt-2">
          Transaction Result
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-8 pt-10 px-8 pb-10">
        <div className="flex flex-col items-center text-center space-y-4">
          <div
            className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-700',
              status === 'confirmed' &&
                'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)] scale-110',
              status === 'failed' &&
                'bg-red-500/10 border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.2)]',
              status === 'pending' &&
                'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_40px_rgba(34,211,238,0.2)]'
            )}
          >
            {config.icon}
          </div>

          <div className="space-y-2">
            <Badge
              className={cn(
                'uppercase tracking-widest text-[9px] font-black px-3 py-1 rounded-full',
                status === 'confirmed' &&
                  'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
                status === 'failed' && 'bg-red-500/20 text-red-400 border-red-500/30',
                status === 'pending' && 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
              )}
              variant="outline"
            >
              {config.label}
            </Badge>
            <h3 className="text-white font-black text-xl uppercase tracking-wider">
              {status === 'confirmed' ? 'Success' : status === 'failed' ? 'Failed' : 'Sending'}
            </h3>
            <p className="text-slate-400 text-xs font-medium leading-relaxed max-w-[240px] mx-auto">
              {config.description}
            </p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-slate-500 uppercase tracking-widest">Transaction Hash</span>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txId}`}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5"
            >
              View Details
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="bg-slate-950 border border-white/5 rounded-xl p-3 font-mono text-[10px] text-slate-300 break-all leading-relaxed shadow-inner">
            {txId}
          </div>
        </div>

        <div className="pt-2">
          <Button
            onClick={onClose}
            className="w-full bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-2xl h-14 font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Button>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[8px] text-slate-700 uppercase tracking-widest font-black pt-2">
          <Info className="w-3 h-3 opacity-50" />
          Transaction finalized on the Stellar Network
        </div>
      </CardContent>
    </Card>
  );
}
