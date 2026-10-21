import React from 'react';
import { StatusScreen } from './StatusScreen';
import type { SendDraft } from '@/hooks/useSendDraft';

export interface SuccessScreenProps {
  txId: string;
  onClose?: () => void;
  failedDraft?: SendDraft;
}

/**
 * SuccessScreen — Send success confirmation displaying the transaction hash
 * with copy button and details link. Delegates to StatusScreen with status="confirmed".
 */
export function SuccessScreen({ txId, onClose, failedDraft }: SuccessScreenProps) {
  return (
    <StatusScreen
      txId={txId}
      status="confirmed"
      onClose={onClose}
      failedDraft={failedDraft}
    />
  );
}

export default SuccessScreen;
