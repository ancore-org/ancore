import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';

import { useSettings } from '../../../hooks/useSettings';
import { SettingsScreen } from '../SettingsScreen';
import { NetworkSettings } from '../NetworkSettings';
import { SecuritySettings } from '../SecuritySettings';
import { AboutScreen } from '../AboutScreen';
import { SettingsGroup, SettingItem } from '../../../components/SettingsGroup';

// ── useSettings ──────────────────────────────────────────────────────────────

describe('useSettings', () => {
  beforeEach(() => localStorage.clear());

  it('returns default settings on first load', () => {
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.network).toBe('testnet');
    expect(result.current.settings.autoLockTimeout).toBe(5);
  });

  it('persists settings to localStorage', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.updateSettings({ network: 'mainnet' }));
    expect(result.current.settings.network).toBe('mainnet');
    const stored = JSON.parse(localStorage.getItem('ancore_settings')!);
    expect(stored.network).toBe('mainnet');
  });

  it('rehydrates settings from localStorage', () => {
    localStorage.setItem(
      'ancore_settings',
      JSON.stringify({ network: 'mainnet', autoLockTimeout: 15 })
    );
    const { result } = renderHook(() => useSettings());
    expect(result.current.settings.network).toBe('mainnet');
    expect(result.current.settings.autoLockTimeout).toBe(15);
  });

  it('merges partial updates', () => {
    const { result } = renderHook(() => useSettings());
    act(() => result.current.updateSettings({ autoLockTimeout: 30 }));
    expect(result.current.settings.network).toBe('testnet');
    expect(result.current.settings.autoLockTimeout).toBe(30);
  });
});

// ── SettingsGroup / SettingItem ──────────────────────────────────────────────

describe('SettingsGroup', () => {
  it('renders title and children', () => {
    render(
      <SettingsGroup title="Network">
        <SettingItem label="Network" value="Testnet" />
      </SettingsGroup>
    );
    expect(screen.getAllByText('Network').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Testnet')).toBeInTheDocument();
  });
});

describe('SettingItem', () => {
  it('renders as button when onClick provided', () => {
    const onClick = vi.fn();
    render(<SettingItem label="Change Password" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /change password/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies danger styling', () => {
    render(<SettingItem label="Export Key" danger onClick={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /export key/i });
    expect(btn.className).toContain('text-destructive');
  });
});

// ── NetworkSettings ──────────────────────────────────────────────────────────

describe('NetworkSettings', () => {
  it('shows current network as active', () => {
    render(<NetworkSettings value="testnet" onChange={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    // active network has a check icon inside a primary-colored circle
    expect(screen.getByText('Testnet').closest('button')).toHaveClass('border-primary');
  });

  it('switches to testnet without confirmation', async () => {
    const onChange = vi.fn();
    const onBack = vi.fn();
    render(<NetworkSettings value="mainnet" onChange={onChange} onBack={onBack} />);
    await userEvent.click(screen.getByText('Testnet'));
    expect(onChange).toHaveBeenCalledWith('testnet');
    expect(onBack).toHaveBeenCalled();
  });

  it('shows mainnet warning before switching', async () => {
    render(<NetworkSettings value="testnet" onChange={vi.fn()} onBack={vi.fn()} />);
    await userEvent.click(screen.getByText('Mainnet'));
    expect(screen.getByText(/switch to mainnet\?/i)).toBeInTheDocument();
  });

  it('confirms mainnet switch', async () => {
    const onChange = vi.fn();
    const onBack = vi.fn();
    render(<NetworkSettings value="testnet" onChange={onChange} onBack={onBack} />);
    await userEvent.click(screen.getByText('Mainnet'));
    await userEvent.click(screen.getByRole('button', { name: /switch to mainnet/i }));
    expect(onChange).toHaveBeenCalledWith('mainnet');
    expect(onBack).toHaveBeenCalled();
  });

  it('cancels mainnet switch', async () => {
    const onChange = vi.fn();
    render(<NetworkSettings value="testnet" onChange={onChange} onBack={vi.fn()} />);
    await userEvent.click(screen.getByText('Mainnet'));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('Testnet')).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn();
    render(<NetworkSettings value="testnet" onChange={vi.fn()} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

// ── SecuritySettings ─────────────────────────────────────────────────────────

describe('SecuritySettings', () => {
  const defaultProps = {
    autoLockTimeout: 5,
    onAutoLockChange: vi.fn(),
    onBack: vi.fn(),
  };

  it('renders security menu items', () => {
    render(<SecuritySettings {...defaultProps} />);
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByText('Auto-lock Timeout')).toBeInTheDocument();
    expect(screen.getByText('Export Private Key')).toBeInTheDocument();
    expect(screen.getByText('Export Recovery Phrase')).toBeInTheDocument();
  });

  it('navigates to change password view', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Change Password'));
    expect(screen.getByPlaceholderText('Enter current password')).toBeInTheDocument();
  });

  it('shows password mismatch error', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Change Password'));
    await userEvent.type(screen.getByPlaceholderText('Enter current password'), 'oldpass');
    await userEvent.type(screen.getByPlaceholderText('Min. 8 characters'), 'newpass1');
    await userEvent.type(screen.getByPlaceholderText('Repeat new password'), 'newpass2');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('shows short password error', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Change Password'));
    await userEvent.type(screen.getByPlaceholderText('Enter current password'), 'old');
    await userEvent.type(screen.getByPlaceholderText('Min. 8 characters'), 'short');
    await userEvent.type(screen.getByPlaceholderText('Repeat new password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('navigates to auto-lock view and selects option', async () => {
    const onAutoLockChange = vi.fn();
    render(<SecuritySettings {...defaultProps} onAutoLockChange={onAutoLockChange} />);
    await userEvent.click(screen.getByText('Auto-lock Timeout'));
    await userEvent.click(screen.getByText('15 minutes'));
    expect(onAutoLockChange).toHaveBeenCalledWith(15);
  });

  it('shows export key warning and requires password', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Export Private Key'));
    expect(screen.getByText(/private key grants full control/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter password/i)).toBeInTheDocument();
  });

  it('shows export mnemonic warning', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Export Recovery Phrase'));
    expect(screen.getByText(/recovery phrase can restore/i)).toBeInTheDocument();
  });

  it('reveals secret after password entry', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Export Private Key'));
    await userEvent.type(screen.getByPlaceholderText(/enter password/i), 'mypassword');
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText(/never share this with anyone/i)).toBeInTheDocument();
  });

  it('shows error when reveal attempted without password', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Export Private Key'));
    await userEvent.click(screen.getByRole('button', { name: /reveal/i }));
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
  });
});

// ── AboutScreen ──────────────────────────────────────────────────────────────

describe('AboutScreen', () => {
  it('renders version and links', () => {
    render(<AboutScreen onBack={vi.fn()} />);
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(screen.getByText('Telegram Community')).toBeInTheDocument();
    expect(screen.getByText('Report a Bug')).toBeInTheDocument();
  });

  it('calls onBack', async () => {
    const onBack = vi.fn();
    render(<AboutScreen onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /go back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

// ── SettingsScreen (integration) ─────────────────────────────────────────────

describe('SettingsScreen', () => {
  beforeEach(() => localStorage.clear());

  it('renders all top-level groups', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getAllByText('Network').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('About Ancore')).toBeInTheDocument();
  });

  it('navigates to network settings', async () => {
    render(<SettingsScreen />);
    // click the Network row button (the SettingItem, not the section heading)
    const networkButtons = screen.getAllByRole('button');
    const networkRowBtn = networkButtons.find(
      (b) => b.textContent?.includes('Network') && b.textContent?.includes('Testnet')
    );
    await userEvent.click(networkRowBtn!);
    expect(screen.getByText('Testnet')).toBeInTheDocument();
    expect(screen.getByText('Mainnet')).toBeInTheDocument();
  });

  it('navigates to security settings', async () => {
    render(<SettingsScreen />);
    await userEvent.click(screen.getByText('Change Password'));
    expect(screen.getByText('Export Private Key')).toBeInTheDocument();
  });

  it('navigates to about screen', async () => {
    render(<SettingsScreen />);
    await userEvent.click(screen.getByText('About Ancore'));
    expect(screen.getByText(/0\.1\.0/)).toBeInTheDocument();
  });

  it('shows current network in root view', () => {
    localStorage.setItem(
      'ancore_settings',
      JSON.stringify({ network: 'mainnet', autoLockTimeout: 5 })
    );
    render(<SettingsScreen />);
    expect(screen.getAllByText('Mainnet').length).toBeGreaterThanOrEqual(1);
  });
});
