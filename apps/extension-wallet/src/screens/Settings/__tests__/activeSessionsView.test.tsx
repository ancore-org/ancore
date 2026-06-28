import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDeviceSessionsStore, type DeviceSession } from '../../../stores/deviceSessions';
import { SecuritySettings } from '../SecuritySettings';

// vault-export pulls in @ancore/crypto which is not built in test env — mock it
vi.mock('../../../security/vault-export', () => ({
  VaultExportError: class VaultExportError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'VaultExportError';
    }
  },
  revealVaultSecret: vi.fn(async ({ kind }: { kind: 'privateKey' | 'mnemonic' }) =>
    kind === 'privateKey' ? 'STESTPRIVATEKEY' : 'word '.repeat(12).trim()
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDevice(overrides: Partial<DeviceSession> = {}): DeviceSession {
  return {
    id: 'device-1',
    deviceName: 'Firefox on Windows',
    browser: 'Firefox 125',
    os: 'Windows 11',
    lastSeenAt: new Date('2026-05-28T10:00:00Z').toISOString(),
    isCurrent: false,
    trusted: true,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  autoLockTimeout: 15,
  onAutoLockChange: vi.fn(),
  requirePasswordForSensitiveActions: true,
  onRequirePasswordForSensitiveActionsChange: vi.fn(),
  onBack: vi.fn(),
};

function renderSecuritySettings() {
  return render(<SecuritySettings {...DEFAULT_PROPS} />);
}

function navigateToActiveSessions() {
  const btn = screen.getByRole('button', { name: /active sessions/i });
  fireEvent.click(btn);
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  useDeviceSessionsStore.setState({ devices: [], alertDeviceId: null });
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ActiveSessionsView', () => {
  it('renders "No active sessions" when the store is empty', () => {
    renderSecuritySettings();
    navigateToActiveSessions();
    expect(screen.getByText('No active sessions')).toBeTruthy();
  });

  it('renders a row for each device in the store', () => {
    useDeviceSessionsStore.setState({
      devices: [
        makeDevice({ id: 'a', deviceName: 'Chrome on MacBook' }),
        makeDevice({ id: 'b', deviceName: 'Safari on iPhone' }),
      ],
      alertDeviceId: null,
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    expect(screen.getByText('Chrome on MacBook')).toBeTruthy();
    expect(screen.getByText('Safari on iPhone')).toBeTruthy();
  });

  it('shows "(this device)" label on the current device row', () => {
    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'current', isCurrent: true })],
      alertDeviceId: null,
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    expect(screen.getByText('(this device)')).toBeTruthy();
  });

  it('Revoke button is disabled for the current device', () => {
    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'current', isCurrent: true })],
      alertDeviceId: null,
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    expect(revokeButtons[0]).toBeDisabled();
  });

  it('clicking Revoke calls revokeDevice with the device id', () => {
    const revokeSpy = vi.spyOn(useDeviceSessionsStore.getState(), 'revokeDevice');

    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'target-device', isCurrent: false })],
      alertDeviceId: null,
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    const revokeBtn = screen.getByRole('button', { name: /revoke/i });
    fireEvent.click(revokeBtn);

    expect(revokeSpy).toHaveBeenCalledWith('target-device');
  });

  it('shows the new-device alert banner when alertDeviceId is set', () => {
    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'new-device', isCurrent: false })],
      alertDeviceId: 'new-device',
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    expect(screen.getByTestId('new-device-alert')).toBeTruthy();
    expect(screen.getByText(/new device signed in/i)).toBeTruthy();
  });

  it('does not show the alert banner when alertDeviceId is null', () => {
    useDeviceSessionsStore.setState({
      devices: [makeDevice({ id: 'known-device', isCurrent: false })],
      alertDeviceId: null,
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    expect(screen.queryByTestId('new-device-alert')).toBeNull();
  });

  it('clicking the dismiss button calls dismissAlert', () => {
    const dismissSpy = vi.spyOn(useDeviceSessionsStore.getState(), 'dismissAlert');

    useDeviceSessionsStore.setState({
      devices: [makeDevice({ isCurrent: false })],
      alertDeviceId: 'device-1',
    });

    renderSecuritySettings();
    navigateToActiveSessions();

    const dismissBtn = screen.getByRole('button', { name: /dismiss alert/i });
    fireEvent.click(dismissBtn);

    expect(dismissSpy).toHaveBeenCalled();
  });

  it('Done button navigates back to the security menu', () => {
    renderSecuritySettings();
    navigateToActiveSessions();

    expect(screen.getByText('Active Sessions')).toBeTruthy();

    const doneBtn = screen.getByRole('button', { name: /done/i });
    fireEvent.click(doneBtn);

    expect(screen.getByText('Security')).toBeTruthy();
  });
});
