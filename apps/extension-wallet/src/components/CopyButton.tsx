import React from 'react';
import { Copy, Check } from 'lucide-react';

export interface CopyButtonProps {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  iconClassName?: string;
  testId?: string;
  children?: React.ReactNode;
}

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied!',
  className = '',
  iconClassName = 'w-3.5 h-3.5',
  testId = 'copy-btn',
  children,
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browser/testing environments
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopied(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Gracefully handle permission rejection
      setCopied(false);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        data-testid={testId}
        aria-label={copied ? copiedLabel : label}
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
          copied
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'text-slate-400 hover:text-white hover:bg-white/10'
        } ${className}`}
      >
        {copied ? (
          <Check
            className={`${iconClassName} text-emerald-400 animate-in zoom-in-50 duration-200`}
          />
        ) : (
          <Copy className={iconClassName} />
        )}
        {children || <span>{copied ? copiedLabel : label}</span>}
      </button>

      {/* Floating tooltip feedback */}
      {copied && (
        <span
          role="status"
          data-testid="copy-tooltip"
          className="absolute -top-7 left-1/2 -translate-x-1/2 rounded bg-slate-900 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-200"
        >
          {copiedLabel}
        </span>
      )}
    </div>
  );
}
