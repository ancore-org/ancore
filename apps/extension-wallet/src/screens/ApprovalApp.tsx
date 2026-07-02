import { SignTransactionApprovalScreen } from './SignTransactionApprovalScreen';

type ApprovalRoute =
  | 'grant-access'
  | 'sign-transaction'
  | 'sign-auth-entry'
  | 'request-session-key';

const routeCopy: Record<ApprovalRoute, { title: string; subtitle: string; description: string }> = {
  'grant-access': {
    title: 'Grant Access',
    subtitle: 'Review and approve dApp access',
    description:
      'A dApp is requesting access to your wallet account. Approve only if you trust the source.',
  },
  'sign-transaction': {
    title: 'Sign Transaction',
    subtitle: 'Review and approve the transaction',
    description:
      'A dApp is requesting to sign a transaction. Approve only if you trust the source.',
  },
  'sign-auth-entry': {
    title: 'Sign Auth Entry',
    subtitle: 'Review and approve the authorization entry',
    description:
      'A dApp is requesting to sign an authorization entry. Approve only if you trust the source.',
  },
  'request-session-key': {
    title: 'Session Key Request',
    subtitle: 'Review scoped session key permissions',
    description:
      'A dApp is requesting a session key with specific permissions, contract allowlist, and spend limits.',
  },
};

function getApprovalRoute(params: URLSearchParams): ApprovalRoute {
  const route = params.get('route');
  if (route === 'grant-access' || route === 'sign-auth-entry' || route === 'request-session-key') {
    return route;
  }
  return 'sign-transaction';
}

export function ApprovalApp() {
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get('requestId');
  const copy = routeCopy[getApprovalRoute(params)];

  if (!requestId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-muted-foreground">
        No approval request found.
      </div>
    );
  }

  return <SignTransactionApprovalScreen requestId={requestId} {...copy} />;
}
