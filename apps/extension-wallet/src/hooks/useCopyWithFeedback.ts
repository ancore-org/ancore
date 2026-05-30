import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '@ancore/ui-kit';
import { getTelemetry } from '@/telemetry';
import { announceToScreenReader } from '@/utils/accessibility';

const COPY_DEBOUNCE_MS = 1000;
const COPIED_ICON_MS = 2000;

export const COPY_SUCCESS_TOAST = 'Address copied';
export const COPY_ERROR_TOAST = 'Could not copy address';
export const COPY_SUCCESS_ANNOUNCEMENT = 'Address copied to clipboard';

export function useCopyWithFeedback() {
  const { showSuccess, showError } = useToast();
  const [copied, setCopied] = useState(false);
  const lastCopyAtRef = useRef(0);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (now - lastCopyAtRef.current < COPY_DEBOUNCE_MS) {
        return;
      }
      lastCopyAtRef.current = now;

      try {
        await navigator.clipboard.writeText(text);
        showSuccess(COPY_SUCCESS_TOAST);
        announceToScreenReader(COPY_SUCCESS_ANNOUNCEMENT);
        getTelemetry().emitAddressCopied();
        setCopied(true);
        if (copiedTimeoutRef.current) {
          clearTimeout(copiedTimeoutRef.current);
        }
        copiedTimeoutRef.current = setTimeout(() => setCopied(false), COPIED_ICON_MS);
      } catch {
        showError(COPY_ERROR_TOAST);
        announceToScreenReader(COPY_ERROR_TOAST, 'assertive');
      }
    },
    [showSuccess, showError]
  );

  return { copy, copied };
}
