import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { NotificationProvider } from '@ancore/ui-kit';

vi.mock('qrcode.react', () => {
  const MockQRCodeSVG = ({
    value,
    'aria-label': ariaLabel,
  }: {
    value: string;
    'aria-label'?: string;
  }) => <svg data-testid="qr-code-svg" data-value={value} aria-label={ariaLabel} />;
  MockQRCodeSVG.displayName = 'QRCodeSVG';
  return { QRCodeSVG: MockQRCodeSVG };
});

vi.mock('@/router/AuthGuard', () => ({
  useExtensionAuth: () => ({
    authState: { smartAccountId: undefined, accountAddress: 'GCFX...WALLET' },
  }),
}));

import { ReceiveScreen } from '@/screens/ReceiveScreen';

const SMART_ACCOUNT_ID = 'CA3D5K7UQJZ5BFPZ5G2FYJ3GX7CJYJ2CQZ5BFPZ5G2FYJ3GX7CJYJ2C';
const OWNER_PUBLIC_KEY = 'GA7QNPKKJ3ZYXPWLUVFXZNXUVXJTQPWMQHZMDMQHLS5VNLQBQNPFLM';

function renderReceive(ui: React.ReactElement) {
  return render(<NotificationProvider>{ui}</NotificationProvider>);
}

// ─── Test suite ──────────────────────────────────────────────────────────────
describe('ReceiveScreen', () => {
  describe('empty state', () => {
    it('renders empty state when no smartAccountId is provided', () => {
      renderReceive(<ReceiveScreen />);
      expect(
        screen.getByText('Complete onboarding to get your receive address')
      ).toBeInTheDocument();
    });

    it('does not crash when neither props nor auth context have smartAccountId', () => {
      renderReceive(<ReceiveScreen />);
      expect(screen.getByRole('heading', { name: /receive/i })).toBeInTheDocument();
    });
  });

  describe('rendering', () => {
    it('renders the screen title', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);
      expect(screen.getByRole('heading', { name: /receive/i })).toBeInTheDocument();
    });

    it('renders the QR code with the SEP-7 payment URI', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} network="testnet" />);
      const qr = screen.getByTestId('qr-code-svg');
      expect(qr).toBeInTheDocument();
      expect(qr).toHaveAttribute(
        'data-value',
        `web+stellar:pay?destination=${encodeURIComponent(SMART_ACCOUNT_ID)}&network=testnet`
      );
    });

    it('renders the contract ID label', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);
      expect(screen.getByText('Contract ID')).toBeInTheDocument();
    });

    it('renders the owner public key when provided', () => {
      renderReceive(
        <ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} ownerPublicKey={OWNER_PUBLIC_KEY} />
      );
      expect(screen.getByText('Owner public key')).toBeInTheDocument();
    });

    it('does not render owner public key when not provided', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);
      expect(screen.queryByText('Owner public key')).not.toBeInTheDocument();
    });
  });

  describe('network indicator', () => {
    it('shows "Mainnet" badge by default', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);
      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('shows "Testnet" badge when network is testnet', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} network="testnet" />);
      expect(screen.getByText('Testnet')).toBeInTheDocument();
    });

    it('shows "Futurenet" badge when network is futurenet', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} network="futurenet" />);
      expect(screen.getByText('Futurenet')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls onBack when the back button is clicked', async () => {
      const user = userEvent.setup();
      const handleBack = vi.fn();
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} onBack={handleBack} />);

      await user.click(screen.getByRole('button', { name: /go back/i }));

      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('does not render back button when onBack is not provided', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);
      expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument();
    });
  });

  describe('copy addresses', () => {
    it('copies the smart account ID to the clipboard when copy button is clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText');
      writeText.mockResolvedValue(undefined);

      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);

      const copyBtns = screen.getAllByRole('button', { name: /copy address/i });
      await user.click(copyBtns[0]);

      expect(writeText).toHaveBeenCalledWith(SMART_ACCOUNT_ID);
    });

    it('copies the owner public key when its copy button is clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText');
      writeText.mockResolvedValue(undefined);

      renderReceive(
        <ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} ownerPublicKey={OWNER_PUBLIC_KEY} />
      );

      const copyBtns = screen.getAllByRole('button', { name: /copy address/i });
      await user.click(copyBtns[1]);

      expect(writeText).toHaveBeenCalledWith(OWNER_PUBLIC_KEY);
    });

    it('shows success toast after copying smart account ID', async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);

      const copyBtns = screen.getAllByRole('button', { name: /copy address/i });
      await user.click(copyBtns[0]);

      await waitFor(() => {
        expect(screen.getByText('Address copied')).toBeInTheDocument();
      });
    });
  });

  describe('QR generation', () => {
    it('encodes SEP-7 payment URI in the QR code', () => {
      const smartAccountId = 'CA3D5K7UQJZ5BFPZ5G2FYJ3GX7CJYJ2CQZ5BFPZ5G2FYJ3GX7CJYJ2C';
      renderReceive(<ReceiveScreen smartAccountId={smartAccountId} network="testnet" />);
      const expectedUri = `web+stellar:pay?destination=${encodeURIComponent(smartAccountId)}&network=testnet`;
      expect(screen.getByTestId('qr-code-svg')).toHaveAttribute('data-value', expectedUri);
    });

    it('renders a different QR value when network changes', () => {
      const { rerender } = renderReceive(
        <ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} network="testnet" />
      );
      const testnetUri = `web+stellar:pay?destination=${encodeURIComponent(SMART_ACCOUNT_ID)}&network=testnet`;
      expect(screen.getByTestId('qr-code-svg')).toHaveAttribute('data-value', testnetUri);

      rerender(
        <NotificationProvider>
          <ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} network="mainnet" />
        </NotificationProvider>
      );
      const mainnetUri = `web+stellar:pay?destination=${encodeURIComponent(SMART_ACCOUNT_ID)}&network=mainnet`;
      expect(screen.getByTestId('qr-code-svg')).toHaveAttribute('data-value', mainnetUri);
    });
  });

  describe('download QR', () => {
    it('renders a download QR code button', () => {
      renderReceive(<ReceiveScreen smartAccountId={SMART_ACCOUNT_ID} />);
      expect(screen.getByRole('button', { name: /download qr code/i })).toBeInTheDocument();
    });
  });
});
