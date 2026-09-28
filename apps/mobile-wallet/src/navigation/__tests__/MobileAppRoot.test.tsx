import { render, screen } from '@testing-library/react';
import { DEV_MOBILE_WALLET_ENV } from '../../config/dev-defaults';
import { useAppGate } from '../../config/hooks/useAppGate';
import { isDeviceCompromised } from '../../security/jailbreak';
import { MobileAppRoot } from '../MobileAppRoot';

jest.mock('../../security/jailbreak', () => ({
  isDeviceCompromised: jest.fn(() => false),
}));

jest.mock('../../config/hooks/useAppGate', () => ({
  useAppGate: jest.fn(() => ({ isLoading: false, result: { status: 'ok' } })),
}));

const mockedIsDeviceCompromised = isDeviceCompromised as jest.MockedFunction<
  typeof isDeviceCompromised
>;
const mockedUseAppGate = useAppGate as jest.MockedFunction<typeof useAppGate>;

describe('MobileAppRoot security gates', () => {
  beforeEach(() => {
    mockedIsDeviceCompromised.mockReturnValue(false);
    mockedUseAppGate.mockReturnValue({ isLoading: false, result: { status: 'ok' } });
  });

  it('blocks a compromised device before onboarding', async () => {
    mockedIsDeviceCompromised.mockReturnValue(true);

    render(<MobileAppRoot env={DEV_MOBILE_WALLET_ENV} />);

    expect(await screen.findByRole('heading', { name: 'Security Warning' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Create a new wallet' })).not.toBeInTheDocument();
  });

  it('shows the maintenance screen when remote config says so', () => {
    mockedUseAppGate.mockReturnValue({
      isLoading: false,
      result: { status: 'maintenance', message: 'Scheduled upgrade' },
    });

    render(<MobileAppRoot env={DEV_MOBILE_WALLET_ENV} />);

    expect(screen.getByRole('heading', { name: 'Down for maintenance' })).toBeInTheDocument();
    expect(screen.getByText('Scheduled upgrade')).toBeInTheDocument();
  });

  it('shows the force-update screen when the installed version is too old', () => {
    mockedUseAppGate.mockReturnValue({
      isLoading: false,
      result: {
        status: 'force-update',
        minimumAppVersion: '2.0.0',
        updateUrl: 'https://example.test/update',
      },
    });

    render(
      <MobileAppRoot env={{ ...DEV_MOBILE_WALLET_ENV, ANCORE_MOBILE_APP_VERSION: '1.0.0' }} />
    );

    expect(screen.getByRole('heading', { name: 'Update required' })).toBeInTheDocument();
    expect(screen.getByText(/version 2\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText('Installed version: 1.0.0')).toBeInTheDocument();
  });
});
