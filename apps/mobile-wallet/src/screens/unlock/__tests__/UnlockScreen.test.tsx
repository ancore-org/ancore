import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { BiometricLockoutManager } from '../../../security/biometric-lockout-manager';
import type {
  IBiometricAuthService,
  IPasswordAuthService,
} from '../../../security/hooks/useBiometricUnlock';
import { UnlockScreen } from '../UnlockScreen';

function makeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: async (key: string) => store[key] ?? null,
    setItem: async (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: async (key: string) => {
      delete store[key];
    },
  };
}

type BiometricOutcome = 'success' | 'fail';

function makeBiometric(
  outcome: BiometricOutcome = 'fail',
  available = true
): IBiometricAuthService {
  return {
    isAvailable: jest.fn(async () => available),
    authenticate: jest.fn(async () =>
      outcome === 'success'
        ? { success: true }
        : { success: false, errorCode: 'AUTHENTICATION_FAILED' as const }
    ),
  };
}

function makePassword(correct = 'secret'): IPasswordAuthService {
  return { authenticate: jest.fn(async (password: string) => password === correct) };
}

function setup(
  options: { biometric?: IBiometricAuthService; password?: IPasswordAuthService } = {}
) {
  const biometricService = options.biometric ?? makeBiometric('fail');
  const passwordService = options.password ?? makePassword();
  const lockoutManager = new BiometricLockoutManager(makeStorage());
  const onUnlocked = jest.fn();

  render(
    <UnlockScreen
      lockoutManager={lockoutManager}
      biometricService={biometricService}
      passwordService={passwordService}
      onUnlocked={onUnlocked}
    />
  );
  return { biometricService, passwordService, lockoutManager, onUnlocked };
}

const ready = () => screen.findByRole('heading');

describe('UnlockScreen', () => {
  describe('loading', () => {
    it('announces loading politely, then shows the unlock screen', async () => {
      setup();

      expect(screen.getByText('Loading…')).toHaveAttribute('aria-live', 'polite');
      expect(await ready()).toHaveTextContent('Unlock Wallet');
    });
  });

  describe('biometric unlock', () => {
    it('prompts for biometrics on mount and unlocks on success', async () => {
      const { biometricService, onUnlocked } = setup({ biometric: makeBiometric('success') });

      await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
      expect(biometricService.authenticate).toHaveBeenCalledTimes(1);
    });

    it('prompts only once on mount', async () => {
      const { biometricService } = setup({ biometric: makeBiometric('fail') });

      await screen.findByLabelText(/attempts remaining/);
      expect(biometricService.authenticate).toHaveBeenCalledTimes(1);
    });

    it('invites biometric verification and offers the Use Biometrics button', async () => {
      setup({ biometric: makeBiometric('fail') });

      await ready();
      expect(screen.getByText('Verify your identity using biometrics.')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Use Biometrics' })).toBeInTheDocument();
    });

    it('shows the attempts indicator after a failed attempt', async () => {
      setup({ biometric: makeBiometric('fail') });

      expect(await screen.findByLabelText('2 of 3 attempts remaining')).toBeInTheDocument();
    });

    it('lets the user try biometrics again', async () => {
      const { biometricService } = setup({ biometric: makeBiometric('fail') });
      await screen.findByLabelText('2 of 3 attempts remaining');

      fireEvent.click(screen.getByRole('button', { name: 'Use Biometrics' }));

      expect(await screen.findByLabelText('1 of 3 attempts remaining')).toBeInTheDocument();
      expect(biometricService.authenticate).toHaveBeenCalledTimes(2);
    });

    it('shows the polite loading text and no buttons while the biometric prompt is open', async () => {
      // The hook sets isLoading while a prompt is pending, and the screen returns its
      // loading view for isLoading, so the "Waiting for biometric…" button label is not
      // reachable. That is how the screen behaved before the conversion; this pins it.
      let finish!: (result: { success: boolean }) => void;
      const biometric: IBiometricAuthService = {
        isAvailable: jest.fn(async () => true),
        authenticate: jest.fn(
          () => new Promise((resolve) => (finish = resolve as typeof finish)) as never
        ),
      };
      const { onUnlocked } = setup({ biometric });

      await waitFor(() => expect(biometric.authenticate).toHaveBeenCalledTimes(1));
      expect(screen.getByText('Loading…')).toHaveAttribute('aria-live', 'polite');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      finish({ success: true });
      await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    });
  });

  describe('without biometrics', () => {
    it('asks for the password instead and offers no biometric button', async () => {
      const { biometricService } = setup({ biometric: makeBiometric('fail', false) });

      await ready();
      expect(screen.getByText('Use your password to access your wallet.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Use Biometrics' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use Password Instead' })).toBeInTheDocument();
      expect(biometricService.authenticate).not.toHaveBeenCalled();
    });
  });

  describe('password fallback', () => {
    const openFallback = async (options: Parameters<typeof setup>[0] = {}) => {
      const rendered = setup(options);
      await screen.findByRole('button', { name: 'Use Password Instead' });
      fireEvent.click(screen.getByRole('button', { name: 'Use Password Instead' }));
      await screen.findByText('Enter your password');
      return rendered;
    };

    it('shows the password form, focused', async () => {
      await openFallback({ biometric: makeBiometric('fail', false) });

      expect(screen.getByRole('heading')).toHaveTextContent('Enter your password');
      expect(screen.getByLabelText('Password')).toHaveFocus();
    });

    it('unlocks with the right password', async () => {
      const { passwordService, onUnlocked } = await openFallback({
        biometric: makeBiometric('fail', false),
      });

      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

      await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
      expect(passwordService.authenticate).toHaveBeenCalledWith('secret');
    });

    it('unlocks when the keyboard go key is pressed', async () => {
      const { onUnlocked } = await openFallback({ biometric: makeBiometric('fail', false) });

      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
      fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' });

      await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    });

    it('shows an alert and does not unlock with the wrong password', async () => {
      const { onUnlocked } = await openFallback({ biometric: makeBiometric('fail', false) });

      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(onUnlocked).not.toHaveBeenCalled();
    });

    it('offers to go back to biometrics when they are available, and goes back', async () => {
      await openFallback({ biometric: makeBiometric('fail') });

      fireEvent.click(screen.getByRole('button', { name: 'Use biometric instead' }));

      expect(await screen.findByText('Unlock Wallet')).toBeInTheDocument();
    });

    it('does not offer biometrics when they are unavailable', async () => {
      await openFallback({ biometric: makeBiometric('fail', false) });

      expect(
        screen.queryByRole('button', { name: 'Use biometric instead' })
      ).not.toBeInTheDocument();
    });
  });

  describe('lockout', () => {
    const lockOut = async () => {
      const rendered = setup({ biometric: makeBiometric('fail') });
      await screen.findByLabelText('2 of 3 attempts remaining');
      fireEvent.click(screen.getByRole('button', { name: 'Use Biometrics' }));
      await screen.findByLabelText('1 of 3 attempts remaining');
      fireEvent.click(screen.getByRole('button', { name: 'Use Biometrics' }));
      return rendered;
    };

    it('shows the lockout banner after too many failures', async () => {
      await lockOut();

      expect(await screen.findByRole('alert')).toHaveTextContent(/Temporarily locked/);
    });

    it('stops offering biometrics and offers the password instead while locked', async () => {
      await lockOut();
      await screen.findByRole('alert');

      expect(screen.queryByRole('button', { name: 'Use Biometrics' })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/attempts remaining/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use Password to Unlock' })).toBeInTheDocument();
    });

    it('can still unlock with the password while locked', async () => {
      const { onUnlocked } = await lockOut();
      await screen.findByRole('alert');

      fireEvent.click(screen.getByRole('button', { name: 'Use Password to Unlock' }));
      await screen.findByText('Enter your password');
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));

      await waitFor(() => expect(onUnlocked).toHaveBeenCalledTimes(1));
    });
  });

  it('renders only React Native primitives (no section, header, paragraph or HTML button text)', async () => {
    const { container } = render(
      <UnlockScreen
        lockoutManager={new BiometricLockoutManager(makeStorage())}
        biometricService={makeBiometric('fail', false)}
        passwordService={makePassword()}
        onUnlocked={jest.fn()}
      />
    );
    await screen.findAllByRole('heading');

    expect(container.querySelector('section, header, p, form, label')).toBeNull();
  });
});
