import { render } from '@testing-library/react';
import { MobileWalletShell } from '../MobileWalletShell';

describe('MobileWalletShell', () => {
  it('renders app name', () => {
    const { getByText } = render(
      <MobileWalletShell appName="Test Wallet" activeRoute="account">
        <div>Child content</div>
      </MobileWalletShell>
    );
    expect(getByText('Test Wallet')).toBeInTheDocument();
  });

  it('renders network badge when network prop is provided', () => {
    const { getByText } = render(
      <MobileWalletShell appName="Test Wallet" activeRoute="account" network="mainnet">
        <div>Child content</div>
      </MobileWalletShell>
    );
    expect(getByText('mainnet')).toBeInTheDocument();
  });

  it('renders network badge for testnet', () => {
    const { getByText } = render(
      <MobileWalletShell appName="Test Wallet" activeRoute="account" network="testnet">
        <div>Child content</div>
      </MobileWalletShell>
    );
    expect(getByText('testnet')).toBeInTheDocument();
  });

  it('does not render network badge when network prop is not provided', () => {
    const { container } = render(
      <MobileWalletShell appName="Test Wallet" activeRoute="account">
        <div>Child content</div>
      </MobileWalletShell>
    );
    expect(container.textContent).not.toContain('mainnet');
    expect(container.textContent).not.toContain('testnet');
  });

  it('renders children', () => {
    const { getByText } = render(
      <MobileWalletShell appName="Test Wallet" activeRoute="account">
        <div>Child content</div>
      </MobileWalletShell>
    );
    expect(getByText('Child content')).toBeInTheDocument();
  });
});
