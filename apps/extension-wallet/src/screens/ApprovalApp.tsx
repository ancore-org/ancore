import { SignTransactionApprovalScreen } from './SignTransactionApprovalScreen';
import { GrantAccessScreen } from './GrantAccess/GrantAccessScreen';

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
  const origin = params.get('origin') ?? undefined;
  const dAppName = params.get('dAppName') ?? undefined;
  const contractId = params.get('contractId') ?? undefined;
  const methodName = params.get('methodName') ?? undefined;
  const route = getApprovalRoute(params);
  const copy = routeCopy[route];

  if (!requestId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center text-sm text-muted-foreground">
        No approval request found.
      </div>
    );
  }

  if (route === 'grant-access') {
    return (
      <GrantAccessScreen
        requestId={requestId}
        dappName={params.get('dappName') || undefined}
        origin={params.get('origin') || undefined}
        iconUrl={params.get('iconUrl') || undefined}
        description={params.get('description') || undefined}
      />
    );
  }

  return (
    <SignTransactionApprovalScreen
      requestId={requestId}
      origin={origin}
      dAppName={dAppName}
      contractId={contractId}
      methodName={methodName}
      requestType={route === 'sign-auth-entry' ? 'sign-auth-entry' : 'sign-transaction'}
      {...copy}
    />
  );
}
