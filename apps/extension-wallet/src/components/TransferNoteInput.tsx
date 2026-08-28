import React from 'react';
import { getRemainingCharacters, MAX_NOTE_LENGTH } from '@/utils/note-validation';
import { Field } from '@ancore/ui-kit';

interface TransferNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * TransferNoteInput - A textarea component for entering transfer notes
 *
 * Features:
 * - 140-character limit enforcement
 * - Real-time character counter
 * - Error validation
 * - Consistent styling with the rest of the wallet UI
 */
export function TransferNoteInput({
  value,
  onChange,
  error,
  className = '',
  label = 'Note',
  placeholder = 'Add a note (optional)',
  disabled = false,
  required = false,
}: TransferNoteInputProps) {
  const remainingChars = getRemainingCharacters(value);
  const isOverLimit = remainingChars < 0;
  const isNearLimit = remainingChars <= 10 && remainingChars >= 0;

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;

    // Allow typing but validate for error display
    onChange(newValue);
  };

  const handleBlur = () => {
    // Validate on blur to enforce the limit
    if (value.trim().length > MAX_NOTE_LENGTH) {
      // Truncate to max length
      onChange(value.trim().slice(0, MAX_NOTE_LENGTH));
    }
  };

  const warning = isOverLimit && !error && (
    <div className="flex items-center gap-2 text-amber-400 text-[10px] font-medium">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-3 h-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      Note exceeds character limit and will be truncated
    </div>
  );

  return (
    <Field label={label} error={error} required={required} className={className}>
      {({ controlProps }) => (
        <>
          <div className="relative">
            <textarea
              {...controlProps}
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              required={required}
              className={`
            w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 
            text-white placeholder:text-slate-600 resize-none
            focus:border-cyan-400 focus:outline-none transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-400 focus:border-red-400' : ''}
            ${isOverLimit ? 'border-red-400 focus:border-red-400' : ''}
          `}
              rows={3}
              maxLength={MAX_NOTE_LENGTH + 10} // Allow slight over-typing for better UX
            />

            {/* Character counter */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1">
              <span
                className={`
              text-[10px] font-mono font-medium transition-colors
              ${isOverLimit ? 'text-red-400' : isNearLimit ? 'text-amber-400' : 'text-slate-600'}
            `}
              >
                {Math.abs(remainingChars)}
              </span>
              <span className="text-[8px] text-slate-600 font-medium">/{MAX_NOTE_LENGTH}</span>
            </div>
          </div>

          {warning}
        </>
      )}
    </Field>
  );
}
