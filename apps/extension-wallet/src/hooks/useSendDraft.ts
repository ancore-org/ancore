import { useState, useCallback } from 'react';

export interface SendDraft {
  recipient: string;
  amount: string;
}

const EMPTY_DRAFT: SendDraft = { recipient: '', amount: '' };

/**
 * useSendDraft — persists send form fields so a failed transaction
 * can be retried without re-entering details.
 *
 * The draft is held in component state (no localStorage) to keep it
 * scoped to the current wallet session.
 */
export function useSendDraft(initial?: Partial<SendDraft>) {
  const [draft, setDraft] = useState<SendDraft>({ ...EMPTY_DRAFT, ...initial });

  const updateDraft = useCallback((patch: Partial<SendDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
  }, []);

  return { draft, updateDraft, clearDraft };
}
