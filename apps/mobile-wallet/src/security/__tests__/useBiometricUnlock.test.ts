/**
 * useBiometricUnlock — hook tests
 *
 * Tests the hook's phase transitions and business logic using
 * mock services and a real BiometricLockoutManager with in-memory storage.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useBiometricUnlock } from '../../security/hooks/useBiometricUnlock';
import { BiometricLockoutManager } from '../../security/biometric-lockout-manager';
import type {
  IBiometricAuthService,
  IPasswordAuthService,
} from '../../security/hooks/useBiometricUnlock';

// ─── Mock storage ─────────────────────────────────────────────────────────────

function makeInMemoryStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => { store[k] = v; },
    removeItem: async (k: string) => { delete store[k]; },
  };
}

// ─── Mock services ────────────────────────────────────────────────────────────

function makeBiometricService(
  successOnCall: number | null = 1,
): IBiometricAuthService & { callCount: number } {
  let callCount = 0;
  return {
    callCount,
    isAvailable: jest.fn(async () => true),
    authenticate: jest.fn(async () => {
      callCount++;
      const success = successOnCall !== null && callCount === successOnCall;
      return success
        ? { success: true }
        : { success: false, errorCode: 'AUTHENTICATION_FAILED' as const };
    }),
  };
}

function makePasswordService(correct = 'secret'): IPasswordAuthService {
  return {
    authenticate: jest.fn(async (pw) => pw === correct),
  };
}

function makeTestHook(
  biometricService: IBiometricAuthService,
  passwordService: IPasswordAuthService,
) {
  const storage = makeInMemoryStorage();
  const lockoutManager = new BiometricLockoutManager(storage);

  return renderHook(() =>
    useBiometricUnlock({
      lockoutManager,
      biometricService,
      passwordService,
      onSuccess: jest.fn(),
    }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useBiometricUnlock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('initializes with idle or loading phase', async () => {
    const { result, waitForNextUpdate } = makeTestHook(
      makeBiometricService(null),
      makePasswordService(),
    );
    expect(result.current.state.isLoading).toBe(true);
    await waitForNextUpdate();
    expect(['idle', 'prompting']).toContain(result.current.state.phase);
  });

  it('transitions to success on valid biometric', async () => {
    const biometric = makeBiometricService(1);
    const { result, waitForNextUpdate } = makeTestHook(biometric, makePasswordService());
    await waitForNextUpdate(); // init complete

    await act(async () => {
      await result.current.attemptBiometric();
    });

    expect(result.current.state.phase).toBe('success');
  });

  it('decrements attemptsRemaining on failure', async () => {
    const biometric = makeBiometricService(null); // always fails
    const { result, waitForNextUpdate } = makeTestHook(biometric, makePasswordService());
    await waitForNextUpdate();

    await act(async () => {
      await result.current.attemptBiometric();
    });

    expect(result.current.state.attemptsRemaining).toBe(2);
    expect(result.current.state.feedbackMessage).not.toBeNull();
  });

  it('locks after max failed attempts', async () => {
    const biometric = makeBiometricService(null);
    const { result, waitForNextUpdate } = makeTestHook(biometric, makePasswordService());
    await waitForNextUpdate();

    for (let i = 0; i < 3; i++) {
      await act(async () => { await result.current.attemptBiometric(); });
    }

    expect(result.current.state.phase).toBe('locked');
    expect(result.current.state.lockoutSecondsRemaining).toBeGreaterThan(0);
  });

  it('switches to fallback phase on switchToPasswordFallback()', async () => {
    const biometric = makeBiometricService(null);
    const { result, waitForNextUpdate } = makeTestHook(biometric, makePasswordService());
    await waitForNextUpdate();

    act(() => { result.current.switchToPasswordFallback(); });

    expect(result.current.state.phase).toBe('fallback');
  });

  it('unlocks via correct password', async () => {
    const biometric = makeBiometricService(null);
    const { result, waitForNextUpdate } = makeTestHook(biometric, makePasswordService('secret'));
    await waitForNextUpdate();

    act(() => { result.current.switchToPasswordFallback(); });

    await act(async () => { await result.current.submitPassword('secret'); });

    expect(result.current.state.phase).toBe('success');
  });

  it('shows passwordError on wrong password', async () => {
    const biometric = makeBiometricService(null);
    const { result, waitForNextUpdate } = makeTestHook(biometric, makePasswordService('secret'));
    await waitForNextUpdate();

    act(() => { result.current.switchToPasswordFallback(); });
    await act(async () => { await result.current.submitPassword('wrong'); });

    expect(result.current.state.passwordError).not.toBeNull();
    expect(result.current.state.phase).toBe('fallback');
  });
});