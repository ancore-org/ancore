import React from 'react';

type NamespaceEntry = {
  chains?: string[];
  methods?: string[];
  events?: string[];
};

export interface SessionProposal {
  id: number;
  params: {
    proposer: {
      metadata: {
        name: string;
        description: string;
        url: string;
        icons: string[];
      };
    };
    requiredNamespaces: Record<string, NamespaceEntry>;
    optionalNamespaces?: Record<string, NamespaceEntry>;
  };
}

interface SessionApprovalSheetProps {
  proposal: SessionProposal;
  onApprove: () => void;
  onReject: () => void;
}

export const SessionApprovalSheet: React.FC<SessionApprovalSheetProps> = ({
  proposal,
  onApprove,
  onReject,
}) => {
  const { proposer, requiredNamespaces, optionalNamespaces } = proposal.params;
  const { metadata } = proposer;

  // Extract requested methods from required and optional namespaces
  const requestedMethods = [
    ...Object.values(requiredNamespaces),
    ...Object.values(optionalNamespaces ?? {}),
  ].flatMap((ns) => ns.methods ?? []);

  return (
    <div className="session-approval-sheet">
      <div className="session-approval-content">
        {/* dApp Info */}
        <div className="dapp-info">
          {metadata.icons && metadata.icons.length > 0 && (
            <img src={metadata.icons[0]} alt={`${metadata.name} icon`} className="dapp-icon" />
          )}
          <h2 className="dapp-name">{metadata.name}</h2>
          <p className="dapp-description">{metadata.description}</p>
          <p className="dapp-url">{metadata.url}</p>
        </div>

        {/* Requested Permissions */}
        <div className="requested-permissions">
          <h3>Requested Permissions</h3>
          <ul className="permissions-list">
            {requestedMethods.map((method: string) => (
              <li key={method} className="permission-item">
                {method}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
          <button onClick={onReject} className="reject-button">
            Reject
          </button>
          <button onClick={onApprove} className="approve-button">
            Connect
          </button>
        </div>
      </div>
    </div>
  );
};
