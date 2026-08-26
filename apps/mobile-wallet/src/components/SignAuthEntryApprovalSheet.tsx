import React from 'react';
import type { SessionTypes } from '@walletconnect/types';

import {
  parseAuthEntryXdr,
  type ParsedAuthEntry,
  type ParsedInvocation,
} from '../walletconnect/auth-entry-parser';

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

const InvocationNode: React.FC<{ invocation: ParsedInvocation; depth: number }> = ({
  invocation,
  depth,
}) => (
  <div className="invocation-node" style={{ marginLeft: depth * 16 }}>
    <p>
      <strong>Contract:</strong> {invocation.contractId}
    </p>
    <p>
      <strong>Function:</strong> {invocation.functionName}
    </p>
    {invocation.args.length > 0 && (
      <p>
        <strong>Args:</strong> {invocation.args.join(', ')}
      </p>
    )}
    {invocation.subInvocations.map((sub, index) => (
      <InvocationNode key={index} invocation={sub} depth={depth + 1} />
    ))}
  </div>
);

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
            <strong>Sub-invocations:</strong> {parsed.subInvocationCount}
          </p>
          <InvocationNode invocation={parsed.invocation} depth={0} />
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

function isWalletConnectSession(value: unknown): value is SessionTypes.Struct {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const session = value as Record<string, unknown>;
  if (typeof session.topic !== 'string') {
    return false;
  }
  if (!session.peer || typeof session.peer !== 'object' || Array.isArray(session.peer)) {
    return false;
  }
  return true;
}

export function parseSignAuthEntryRequest(event: Record<string, unknown>): {
  request: SignAuthEntryRequest;
  parsed: ParsedAuthEntry;
} {
  const rawId = event.id;
  let id: number;
  if (typeof rawId === 'number' && Number.isSafeInteger(rawId)) {
    id = rawId;
  } else if (typeof rawId === 'string' && rawId.trim().length > 0) {
    const parsedId = Number(rawId);
    if (!Number.isSafeInteger(parsedId)) {
      throw new Error('Invalid or missing WalletConnect request id');
    }
    id = parsedId;
  } else {
    throw new Error('Invalid or missing WalletConnect request id');
  }

  const rawTopic = event.topic;
  if (typeof rawTopic !== 'string' || rawTopic.trim().length === 0) {
    throw new Error('Invalid or missing WalletConnect request topic');
  }
  const topic = rawTopic.trim();

  const params = (event.params ?? {}) as { authEntry?: string; entryXdr?: string };
  const entryXdr = params.authEntry ?? params.entryXdr;

  if (!entryXdr) {
    throw new Error('Missing authEntry parameter');
  }

  if (!isWalletConnectSession(event.session)) {
    throw new Error('Invalid or missing WalletConnect session');
  }

  const parsed = parseAuthEntryXdr(entryXdr);

  return {
    request: {
      id,
      topic,
      method: 'stellar_signAuthEntry',
      params: { authEntry: entryXdr },
      session: event.session,
    },
    parsed,
  };
}
