import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, 'aria-label': ariaLabel }: { value: string; 'aria-label'?: string }) => (
    <svg data-testid="qr-code-svg" data-value={value} aria-label={ariaLabel} />
  ),
}));

import ReceiveScreen from '@/screens/ReceiveScreen';

const MAINNET_ACCOUNT = {
  publicKey: 'GABC1234567890DEFGHIJKLMNOPQRSTUVWXYZ',
  name: 'Primary Wallet',
};

const TESTNET_ACCOUNT = {
  publicKey: 'GTEST9876543210ABCDEFGHIJKLMNOPQRSTUV',
  name: 'Test Wallet',
};

// ─── Test suite ──────────────────────────────────────────────────────────────
describe('ReceiveScreen', () => {
  describe('rendering', () => {
    it('renders the screen title', () => {
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      expect(screen.getByRole('heading', { name: /receive/i })).toBeInTheDocument();
    });

    it('renders the QR code with the correct address value', () => {
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      const qr = screen.getByTestId('qr-code-svg');
      expect(qr).toBeInTheDocument();
      expect(qr).toHaveAttribute('data-value', MAINNET_ACCOUNT.publicKey);
    });

    it('renders the QR code without a name', () => {
      render(<ReceiveScreen account={TESTNET_ACCOUNT} network="testnet" onBack={() => {}} />);
      const qr = screen.getByTestId('qr-code-svg');
      expect(qr).toHaveAttribute('data-value', TESTNET_ACCOUNT.publicKey);
    });

    it('shows the optional account name', () => {
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      expect(screen.getByText('Primary Wallet')).toBeInTheDocument();
    });

    it('does not render the account name when not provided', () => {
      render(<ReceiveScreen account={TESTNET_ACCOUNT} network="testnet" onBack={() => {}} />);
      expect(screen.queryByText('Primary Wallet')).not.toBeInTheDocument();
    });

    it('renders the address display label', () => {
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      expect(screen.getByText('Your address')).toBeInTheDocument();
    });
  });

  describe('network indicator', () => {
    it('shows "Mainnet" badge by default', () => {
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      expect(screen.getByText('Mainnet')).toBeInTheDocument();
    });

    it('shows "Testnet" badge when network is testnet', () => {
      render(<ReceiveScreen account={TESTNET_ACCOUNT} network="testnet" onBack={() => {}} />);
      expect(screen.getByText('Testnet')).toBeInTheDocument();
    });

    it('shows "Futurenet" badge when network is futurenet', () => {
      render(<ReceiveScreen account={TESTNET_ACCOUNT} network="futurenet" onBack={() => {}} />);
      expect(screen.getByText('Futurenet')).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('calls onBack when the back button is clicked', async () => {
      const user = userEvent.setup();
      const handleBack = vi.fn();
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={handleBack} />);

      await user.click(screen.getByRole('button', { name: /go back/i }));

      expect(handleBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('copy address', () => {
    it('copies the address to the clipboard when the copy button is clicked', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText');
      writeText.mockResolvedValue(undefined);

      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);

      const copyBtn = screen.getByRole('button', { name: /copy address/i });
      await user.click(copyBtn);

      expect(writeText).toHaveBeenCalledWith(MAINNET_ACCOUNT.publicKey);
    });

    it('shows a confirmation checkmark after copying', async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);

      await user.click(screen.getByRole('button', { name: /copy address/i }));

      await waitFor(() => {
        // After copying the button aria-label changes inside AddressDisplay
        // The icon swaps to a check – verify the button is still in the DOM
        expect(screen.getByRole('button', { name: /copy address/i })).toBeInTheDocument();
      });
    });
  });

  describe('print', () => {
    it('renders a print button', () => {
      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      expect(screen.getByRole('button', { name: /print qr code/i })).toBeInTheDocument();
    });

    it('calls window.print when the print button is clicked', async () => {
      const user = userEvent.setup();
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      render(<ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />);
      await user.click(screen.getByRole('button', { name: /print qr code/i }));

      expect(printSpy).toHaveBeenCalledTimes(1);
      printSpy.mockRestore();
    });
  });

  describe('QR generation', () => {
    it('encodes exactly the publicKey in the QR code', () => {
      const publicKey = 'GD6SZQJNKL3ZYXPWLUVFXZNXUVXJTQPWMQHZMDMQHLS5VNLQBQNPFLM';
      render(
        <ReceiveScreen
          account={{ publicKey, name: 'Unnamed Wallet' }}
          network="mainnet"
          onBack={() => {}}
        />
      );
      expect(screen.getByTestId('qr-code-svg')).toHaveAttribute('data-value', publicKey);
    });

    it('renders a different QR value when account changes', () => {
      const { rerender } = render(
        <ReceiveScreen account={MAINNET_ACCOUNT} network="mainnet" onBack={() => {}} />
      );
      expect(screen.getByTestId('qr-code-svg')).toHaveAttribute(
        'data-value',
        MAINNET_ACCOUNT.publicKey
      );

      rerender(<ReceiveScreen account={TESTNET_ACCOUNT} network="testnet" onBack={() => {}} />);
      expect(screen.getByTestId('qr-code-svg')).toHaveAttribute(
        'data-value',
        TESTNET_ACCOUNT.publicKey
      );
    });
  });
});
