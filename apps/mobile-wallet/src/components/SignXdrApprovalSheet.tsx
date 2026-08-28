import React from 'react';
import type { SessionTypes } from '@walletconnect/types';

export interface SignXdrRequest {
  id: number;
  topic: string;
  method: 'stellar_signXDR' | 'stellar_signAndSubmitXDR';
  params: { xdr?: string; description?: string };
  session: SessionTypes.Struct;
}

interface SignXdrApprovalSheetProps {
  request: SignXdrRequest;
  status: 'pending' | 'success';
  onApprove: () => void;
  onReject: () => void;
}

export const SignXdrApprovalSheet: React.FC<SignXdrApprovalSheetProps> = ({
  request,
  status,
  onApprove,
  onReject,
}) => {
  const dappName = request.session.peer?.metadata?.name ?? 'Unknown dApp';
  const description = request.params.description ?? 'Review this transaction before signing.';

  if (status === 'success') {
    return (
      <div className="sign-xdr-sheet" data-testid="sign-xdr-sheet">
        <h2>Transaction Signed</h2>
        <p>The transaction was signed successfully.</p>
      </div>
    );
  }

  return (
    <div className="sign-xdr-sheet" data-testid="sign-xdr-sheet">
      <h2>Approve Transaction</h2>
      <p className="dapp-name">{dappName}</p>
      <p>{description}</p>
      <div className="action-buttons">
        <button type="button" onClick={onReject}>
          Reject
        </button>
        <button type="button" onClick={onApprove}>
          Approve
        </button>
      </div>
    </div>
  );
};

export function parseSignXdrRequest(event: Record<string, unknown>): SignXdrRequest {
  const rawId = event.id;
  const id = typeof rawId === 'number' ? rawId : Number(rawId);
  const topic = typeof event.topic === 'string' ? event.topic : '';
  const params = (event.params as SignXdrRequest['params'] | undefined) ?? {};
  const method = (event as { method?: string }).method;
  const requestMethod =
    method === 'stellar_signAndSubmitXDR' ? 'stellar_signAndSubmitXDR' : 'stellar_signXDR';
  const session = (event.session ?? {}) as SessionTypes.Struct;

  return {
    id,
    topic,
    method: requestMethod,
    params,
    session,
  };
}
