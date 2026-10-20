import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NetworkSwitcherModal } from '../NetworkSwitcherModal';

describe('NetworkSwitcherModal', () => {
  const mockOnClose = vi.fn();
  const mockOnNetworkChange = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnNetworkChange.mockClear();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <NetworkSwitcherModal
        isOpen={false}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders modal when open', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Switch Network')).toBeInTheDocument();
  });

  it('displays all network options', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByText('Futurenet')).toBeInTheDocument();
    expect(
      screen.getByText('Stellar test network for development and testing')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Experimental network for testing upcoming Stellar features')
    ).toBeInTheDocument();
  });

  it('marks current network', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const currentBadge = screen.getByText('Current');
    expect(currentBadge).toBeInTheDocument();
  });

  it('allows selecting a different network', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const futurenetOption = screen.getByRole('radio', { name: /Futurenet/i });
    fireEvent.click(futurenetOption);

    expect(futurenetOption).toHaveAttribute('aria-checked', 'true');
  });

  it('shows warning when switching networks', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const futurenetOption = screen.getByRole('radio', { name: /Futurenet/i });
    fireEvent.click(futurenetOption);

    expect(
      screen.getByText(/Switching networks will reload your wallet data/i)
    ).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onNetworkChange and onClose when switching networks', async () => {
    mockOnNetworkChange.mockResolvedValue(undefined);

    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const futurenetOption = screen.getByRole('radio', { name: /Futurenet/i });
    fireEvent.click(futurenetOption);

    const switchButton = screen.getByText('Switch Network');
    fireEvent.click(switchButton);

    await waitFor(() => {
      expect(mockOnNetworkChange).toHaveBeenCalledWith('futurenet');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state while switching networks', async () => {
    let resolveNetworkChange: () => void;
    const networkChangePromise = new Promise<void>((resolve) => {
      resolveNetworkChange = resolve;
    });
    mockOnNetworkChange.mockReturnValue(networkChangePromise);

    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const futurenetOption = screen.getByRole('radio', { name: /Futurenet/i });
    fireEvent.click(futurenetOption);

    const switchButton = screen.getByText('Switch Network');
    fireEvent.click(switchButton);

    expect(screen.getByText('Switching...')).toBeInTheDocument();

    resolveNetworkChange!();
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('disables buttons while switching', async () => {
    let resolveNetworkChange: () => void;
    const networkChangePromise = new Promise<void>((resolve) => {
      resolveNetworkChange = resolve;
    });
    mockOnNetworkChange.mockReturnValue(networkChangePromise);

    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const futurenetOption = screen.getByRole('radio', { name: /Futurenet/i });
    fireEvent.click(futurenetOption);

    const switchButton = screen.getByText('Switch Network');
    fireEvent.click(switchButton);

    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
    expect(screen.getByText('Switching...')).toBeDisabled();

    resolveNetworkChange!();
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('does not call onNetworkChange if same network is selected', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const switchButton = screen.getByText('Switch Network');
    expect(switchButton).toBeDisabled();

    fireEvent.click(switchButton);

    expect(mockOnNetworkChange).not.toHaveBeenCalled();
  });

  it('closes modal when backdrop is clicked', () => {
    render(
      <NetworkSwitcherModal
        isOpen={true}
        currentNetwork="testnet"
        onClose={mockOnClose}
        onNetworkChange={mockOnNetworkChange}
      />
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
