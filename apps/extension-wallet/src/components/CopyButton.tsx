import React, { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@ancore/ui-kit';

export interface CopyButtonProps {
  text: string;
  className?: string;
  label?: string;
  tooltipDurationMs?: number;
  onCopySuccess?: () => void;
  onCopyError?: (error: unknown) => void;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for environments where clipboard API is unavailable or denied
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch {
      return false;
    }
  }

  return false;
}

export function CopyButton({
  text,
  className,
  label,
  tooltipDurationMs = 2000,
  onCopySuccess,
  onCopyError,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const success = await copyTextToClipboard(text);
    if (success) {
      setCopied(true);
      onCopySuccess?.();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, tooltipDurationMs);
    } else {
      onCopyError?.(new Error('Failed to copy to clipboard'));
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleCopy}
        data-testid="copy-btn"
        aria-label={label || (copied ? 'Copied!' : 'Copy to clipboard')}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
        className={cn(
          'inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-400',
          className
        )}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>

      {copied && (
        <span
          role="status"
          data-testid="copy-tooltip"
          className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-medium text-white bg-slate-800 border border-white/10 rounded shadow-md pointer-events-none whitespace-nowrap animate-in fade-in zoom-in-95 duration-150 z-50"
        >
          Copied!
        </span>
      )}
    </div>
  );
}

export default CopyButton;
