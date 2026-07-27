import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationProvider } from '@ancore/ui-kit';
import i18n from '../../../i18n';

vi.mock('../../../utils/export-qr', () => {
  const spy = vi.fn(async () => undefined);
  return { default: spy, downloadQrPng: spy };
});

const { default: downloadQrPng } = await import('../../../utils/export-qr');

import { AccountQrScreen } from '../AccountQrScreen';
import { SettingsScreen } from '../SettingsScreen';
import { useAccountStore } from '../../../stores/account';
import { DEFAULTS, useSettingsStore } from '../../../stores/settings';

const CONTRACT_ID = 'CBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const PUBLIC_KEY = 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

function renderScreen(address: string | null, onBack = vi.fn()) {
  return render(
    <NotificationProvider>
      <AccountQrScreen address={address} onBack={onBack} />
    </NotificationProvider>
  );
}

describe('AccountQrScreen', () => {
  beforeEach(() => {
    vi.mocked(downloadQrPng).mockClear();
  });

  it('renders a QR for the public address', () => {
    renderScreen(CONTRACT_ID);

    const qr = screen.getByTestId('payment-qr-code');
    expect(qr).toBeInTheDocument();
    expect(screen.getByLabelText(`QR code for address ${CONTRACT_ID}`)).toBeInTheDocument();
  });

  it('downloads a PNG of the address on request', async () => {
    const user = userEvent.setup();
    renderScreen(CONTRACT_ID);

    await user.click(
      screen.getByRole('button', { name: i18n.t('settings.accountQr.downloadPng') })
    );

    await waitFor(() => expect(downloadQrPng).toHaveBeenCalledTimes(1));
    expect(vi.mocked(downloadQrPng).mock.calls[0][0]).toBe(CONTRACT_ID);
    expect(vi.mocked(downloadQrPng).mock.calls[0][1]).toMatchObject({
      filename: 'ancore-address-CBXXXXXX.png',
    });
  });

  it('shows the public-address-only assurance', () => {
    renderScreen(PUBLIC_KEY);

    expect(screen.getByText(i18n.t('settings.accountQr.safetyTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('settings.accountQr.safetyBody'))).toBeInTheDocument();
  });

  it('offers nothing to export when there is no account address', () => {
    renderScreen(null);

    expect(screen.queryByTestId('payment-qr-code')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: i18n.t('settings.accountQr.downloadPng') })
    ).not.toBeInTheDocument();
    expect(screen.getByText(i18n.t('settings.accountQr.unavailable'))).toBeInTheDocument();
  });

  it('refuses to render or export a secret seed', () => {
    // A secret can only reach this screen through a bug upstream; the render
    // guard has to hold on its own rather than trusting the caller.
    renderScreen('SBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

    expect(screen.queryByTestId('payment-qr-code')).not.toBeInTheDocument();
    expect(downloadQrPng).not.toHaveBeenCalled();
  });

  it('refuses to render a recovery phrase', () => {
    renderScreen('legal winner thank year wave sausage worth useful legal winner thank yellow');

    expect(screen.queryByTestId('payment-qr-code')).not.toBeInTheDocument();
    expect(downloadQrPng).not.toHaveBeenCalled();
  });

  it('goes back when the header back button is pressed', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderScreen(CONTRACT_ID, onBack);

    await user.click(screen.getAllByRole('button')[0]);

    expect(onBack).toHaveBeenCalled();
  });
});

describe('SettingsScreen — address QR entry', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState(DEFAULTS);
    vi.mocked(downloadQrPng).mockClear();
    useAccountStore.setState({
      accounts: [{ id: 'a1', address: PUBLIC_KEY, label: 'Main', contractId: CONTRACT_ID }],
      activeAccountId: 'a1',
    });
  });

  function renderSettings() {
    return render(
      <NotificationProvider>
        <SettingsScreen />
      </NotificationProvider>
    );
  }

  it('exposes an address QR entry from the settings root', () => {
    renderSettings();

    expect(screen.getByText(i18n.t('settings.accountQr.label'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('settings.accountQr.description'))).toBeInTheDocument();
  });

  it('opens the QR screen for the active account contract id', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText(i18n.t('settings.accountQr.label')));

    expect(screen.getByLabelText(`QR code for address ${CONTRACT_ID}`)).toBeInTheDocument();
  });

  it('falls back to the owner public key before the contract is deployed', async () => {
    useAccountStore.setState({
      accounts: [{ id: 'a1', address: PUBLIC_KEY, label: 'Main' }],
      activeAccountId: 'a1',
    });

    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByText(i18n.t('settings.accountQr.label')));

    expect(screen.getByLabelText(`QR code for address ${PUBLIC_KEY}`)).toBeInTheDocument();
  });

  it('does not expose any secret export from the QR screen', async () => {
    const user = userEvent.setup();
    renderSettings();

    // Private key / recovery phrase entries live on the settings root and must
    // not follow the user into the QR screen.
    await user.click(screen.getByText(i18n.t('settings.accountQr.label')));

    expect(
      screen.queryByText(i18n.t('settings.security.exportPrivateKey.label'))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(i18n.t('settings.security.exportRecoveryPhrase.label'))
    ).not.toBeInTheDocument();
  });

  it('returns to the settings root from the QR screen', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText(i18n.t('settings.accountQr.label')));
    await user.click(screen.getAllByRole('button')[0]);

    expect(screen.getByText(i18n.t('settings.title'))).toBeInTheDocument();
  });
});
