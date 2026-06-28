import type { FC, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { useSplitBill } from '../hooks/useSplitBill';
import type { SplitBillParticipant, ParticipantStatus } from '../types/split-bill';

const PARTICIPANT_STATUS_CONFIG: Record<
  ParticipantStatus,
  { label: string; icon: ReactNode; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: <Clock className="w-4 h-4" />,
    className: 'text-amber-600 bg-amber-50',
  },
  paid: {
    label: 'Paid',
    icon: <CheckCircle className="w-4 h-4" />,
    className: 'text-green-600 bg-green-50',
  },
  failed: {
    label: 'Failed',
    icon: <XCircle className="w-4 h-4" />,
    className: 'text-red-600 bg-red-50',
  },
  expired: {
    label: 'Expired',
    icon: <AlertCircle className="w-4 h-4" />,
    className: 'text-slate-500 bg-slate-100',
  },
};

function ParticipantRow({
  participant,
  billId,
  billOpen,
  onUpdate,
}: {
  participant: SplitBillParticipant;
  billId: string;
  billOpen: boolean;
  onUpdate: (billId: string, participantId: string, status: ParticipantStatus) => void;
}) {
  const cfg = PARTICIPANT_STATUS_CONFIG[participant.status];

  return (
    <li className="flex items-center justify-between gap-4 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">{participant.alias ?? participant.address}</p>
        {participant.alias && (
          <p className="text-xs text-slate-500 truncate font-mono">{participant.address}</p>
        )}
        {participant.failedReason && (
          <p className="text-xs text-red-500 mt-0.5">{participant.failedReason}</p>
        )}
        {participant.paidAt && (
          <p className="text-xs text-slate-400 mt-0.5">
            Paid {new Date(participant.paidAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold">
          {participant.amount} {participant.assetCode}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}
        >
          {cfg.icon}
          {cfg.label}
        </span>
        {billOpen && participant.status === 'pending' && (
          <div className="flex gap-1">
            <button
              onClick={() => onUpdate(billId, participant.id, 'paid')}
              className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
              type="button"
            >
              Mark paid
            </button>
            <button
              onClick={() => onUpdate(billId, participant.id, 'failed')}
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
              type="button"
            >
              Mark failed
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export const SplitBillDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBill, updateParticipant, cancelBill } = useSplitBill();

  const bill = id ? getBill(id) : undefined;

  if (!bill) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Split bill not found.</p>
        <button
          onClick={() => navigate('/split-bill')}
          className="mt-4 text-sm text-blue-600 hover:underline"
          type="button"
        >
          Back to split bills
        </button>
      </div>
    );
  }

  const paidCount = bill.participants.filter((p) => p.status === 'paid').length;
  const total = bill.participants.length;
  const progressPct = total > 0 ? Math.round((paidCount / total) * 100) : 0;
  const isOpen = bill.status === 'open';

  const BILL_STATUS_STYLES: Record<string, string> = {
    open: 'text-blue-600 bg-blue-50',
    completed: 'text-green-600 bg-green-50',
    expired: 'text-slate-500 bg-slate-100',
    cancelled: 'text-red-600 bg-red-50',
  };

  return (
    <section aria-label="Split bill detail">
      <button
        onClick={() => navigate('/split-bill')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6"
        type="button"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold">{bill.title}</h2>
          {bill.note && <p className="text-sm text-slate-500 mt-1">{bill.note}</p>}
          <p className="text-xs text-slate-400 mt-1">
            Created {new Date(bill.createdAt).toLocaleString()} · Expires{' '}
            {new Date(bill.expiresAt).toLocaleString()}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${BILL_STATUS_STYLES[bill.status] ?? ''}`}
        >
          {bill.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-600">
            {paidCount} of {total} paid
          </span>
          <span className="font-medium">{progressPct}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Participants */}
      <ul aria-label="Participants">
        {bill.participants.map((p) => (
          <ParticipantRow
            key={p.id}
            participant={p}
            billId={bill.id}
            billOpen={isOpen}
            onUpdate={updateParticipant}
          />
        ))}
      </ul>

      {isOpen && (
        <div className="mt-6 pt-4 border-t">
          <button
            onClick={() => {
              cancelBill(bill.id);
              navigate('/split-bill');
            }}
            className="text-sm text-red-600 hover:underline"
            type="button"
          >
            Cancel this bill
          </button>
        </div>
      )}
    </section>
  );
};
