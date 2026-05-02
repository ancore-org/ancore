import React from 'react';
import { formatNoteForPreview, isNoteEmpty } from '@/utils/note-validation';
import { MessageSquare } from 'lucide-react';

interface TransferNotePreviewProps {
  note: string;
  className?: string;
  showIcon?: boolean;
  truncated?: boolean;
}

/**
 * TransferNotePreview - A component for safely displaying transfer notes
 *
 * Features:
 * - Safe HTML rendering (XSS protection)
 * - Automatic truncation to 140 characters
 * - Empty state handling
 * - Consistent styling with the wallet UI
 */
export function TransferNotePreview({
  note,
  className = '',
  showIcon = true,
  truncated = true,
}: TransferNotePreviewProps) {
  if (isNoteEmpty(note)) {
    return null;
  }

  const displayNote = truncated ? formatNoteForPreview(note) : note;
  const wasTruncated = note.length > 140 && truncated;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-widest">
        {showIcon && <MessageSquare className="w-3.5 h-3.5" />}
        Note
      </div>

      <div className="relative">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
          <p
            className="text-sm text-slate-200 leading-relaxed break-words whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: displayNote.replace(/\n/g, '<br />'),
            }}
          />

          {wasTruncated && (
            <div className="text-xs text-slate-500 italic mt-2">
              Note truncated to {140} characters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * MinimalNotePreview - A compact version for tight spaces
 */
export function MinimalNotePreview({
  note,
  className = '',
}: Omit<TransferNotePreviewProps, 'showIcon' | 'truncated'>) {
  if (isNoteEmpty(note)) {
    return null;
  }

  const displayNote = formatNoteForPreview(note);
  const wasTruncated = note.length > 140;

  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <MessageSquare className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p
          className="text-xs text-slate-300 leading-relaxed break-words"
          dangerouslySetInnerHTML={{
            __html: displayNote.replace(/\n/g, '<br />'),
          }}
        />
        {wasTruncated && <span className="text-xs text-slate-500 italic ml-1">...</span>}
      </div>
    </div>
  );
}
