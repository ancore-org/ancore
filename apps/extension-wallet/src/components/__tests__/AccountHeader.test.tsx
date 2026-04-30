import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountHeader } from '../AccountHeader';
import userEvent from '@testing-library/user-event';

// Mock UI kit components since we are testing the logic in AccountHeader
vi.mock('@ancore/ui-kit', () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  // We need the Tooltip to render its content to test it
  Tooltip: ({ children, content }: any) => (
    <div data-testid="tooltip-wrapper">
      {children}
      <div data-testid="tooltip-content">{content}</div>
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Copy: () => <span data-testid="icon-copy" />,
  Check: () => <span data-testid="icon-check" />,
  Globe: () => <span data-testid="icon-globe" />,
}));

describe('AccountHeader', () => {
  const defaultProps = {
    address: 'GDXYZ...',
    network: 'Testnet',
    onCopyAddress: vi.fn(),
  };

  it('renders the address', () => {
    render(<AccountHeader {...defaultProps} />);
    expect(screen.getByText('GDXYZ...')).toBeInTheDocument();
  });

  describe('Network Badge Tooltip', () => {
    it('displays Sandbox environment for Testnet', () => {
      render(<AccountHeader {...defaultProps} network="Testnet" />);
      expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Environment: Sandbox (Horizon Testnet)');
    });

    it('displays Production environment for Mainnet', () => {
      render(<AccountHeader {...defaultProps} network="Mainnet" />);
      expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Environment: Production (Horizon Mainnet)');
    });

    it('displays Staging environment for Staging', () => {
      render(<AccountHeader {...defaultProps} network="Staging" />);
      expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Environment: Staging (Horizon Testnet)');
    });

    it('displays fallback environment for unknown network', () => {
      render(<AccountHeader {...defaultProps} network="Localhost" />);
      expect(screen.getByTestId('tooltip-content')).toHaveTextContent('Environment: Localhost');
    });
  });
});
