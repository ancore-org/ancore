import React from 'react';
import type { SessionTypes } from '@walletconnect/types';

import { parseAuthEntryXdr, type ParsedAuthEntry } from '../walletconnect/auth-entry-parser';

export interface SignAuthEntryRequest {
  id: number;
  topic: string;
  method: string;
  params: { authEntry?: string; entryXdr?: string };
  session: SessionTypes.Struct;
}

interface SignAuthEntryApprovalSheetProps {
  request: SignAuthEntryRequest;
  parsed: ParsedAuthEntry;
  onApprove: () => void;
  onReject: () => void;
}

export const SignAuthEntryApprovalSheet: React.FC<SignAuthEntryApprovalSheetProps> = ({
  request,
  parsed,
  onApprove,
  onReject,
}) => {
  const dappName = request.session.peer?.metadata?.name ?? 'Unknown dApp';
  const dappUrl = request.session.peer?.metadata?.url ?? '';

  return (
    <div className="sign-auth-entry-sheet" data-testid="sign-auth-entry-sheet">
      <div className="sign-auth-entry-content">
        <h2>Sign Authorization Entry</h2>
        <p className="dapp-name">{dappName}</p>
        <p className="dapp-url">{dappUrl}</p>

        <div className="auth-entry-details">
          <p>
            <strong>Contract:</strong> {parsed.contractId}
          </p>
          <p>
            <strong>Function:</strong> {parsed.functionName}
          </p>
          <p>
            <strong>Sub-invocations:</strong> {parsed.subInvocations}
          </p>
        </div>

        <div className="action-buttons">
          <button type="button" onClick={onReject} className="reject-button">
            Reject
          </button>
          <button type="button" onClick={onApprove} className="approve-button">
            Approve
          </button>
        </div>
      </div>
    </div>
  );
};

export function parseSignAuthEntryRequest(event: Record<string, unknown>): {
  request: SignAuthEntryRequest;
  parsed: ParsedAuthEntry;
} {
  const id = Number(event.id);
  const topic = String(event.topic ?? '');
  const params = (event.params ?? {}) as { authEntry?: string; entryXdr?: string };
  const entryXdr = params.authEntry ?? params.entryXdr;

  if (!entryXdr) {
    throw new Error('Missing authEntry parameter');
  }

  const parsed = parseAuthEntryXdr(entryXdr);

  return {
    request: {
      id,
      topic,
      method: 'stellar_signAuthEntry',
      params: { authEntry: entryXdr },
      session: event.session as SessionTypes.Struct,
    },
    parsed,
  };
}
