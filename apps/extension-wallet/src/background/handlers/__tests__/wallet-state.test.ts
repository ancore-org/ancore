import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerWalletStateHandlers } from '../wallet-state';
import { registerHandler } from '@/messaging';
import { isBackgroundSessionUnlockedAsync } from '../../session-state';
import { readAuthState } from '@/router/AuthGuard';

vi.mock('@/messaging', () => ({
  registerHandler: vi.fn(),
}));

vi.mock('../../session-state', () => ({
  isBackgroundSessionUnlockedAsync: vi.fn(),
}));

vi.mock('@/router/AuthGuard', () => ({
  readAuthState: vi.fn(),
}));

describe('wallet-state handler', () => {
  let handlerCb: () => Promise<{ state: string }>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(registerHandler).mockImplementation((_type: string, cb: any) => {
      handlerCb = cb;
    });
    registerWalletStateHandlers();
  });

  it('registers GET_WALLET_STATE handler', () => {
    expect(registerHandler).toHaveBeenCalledWith('GET_WALLET_STATE', expect.any(Function));
  });

  it('returns uninitialized when user has not onboarded', async () => {
    vi.mocked(readAuthState).mockReturnValue({
      hasOnboarded: false,
      walletName: 'Test',
      accountAddress: 'G...',
    });

    const result = await handlerCb();
    expect(result).toEqual({ state: 'uninitialized' });
  });

  it('returns unlocked when session is restored/unlocked', async () => {
    vi.mocked(readAuthState).mockReturnValue({
      hasOnboarded: true,
      walletName: 'Test',
      accountAddress: 'G...',
    });
    vi.mocked(isBackgroundSessionUnlockedAsync).mockResolvedValue(true);

    const result = await handlerCb();
    expect(result).toEqual({ state: 'unlocked' });
    expect(isBackgroundSessionUnlockedAsync).toHaveBeenCalled();
  });

  it('returns locked when session is not unlocked', async () => {
    vi.mocked(readAuthState).mockReturnValue({
      hasOnboarded: true,
      walletName: 'Test',
      accountAddress: 'G...',
    });
    vi.mocked(isBackgroundSessionUnlockedAsync).mockResolvedValue(false);

    const result = await handlerCb();
    expect(result).toEqual({ state: 'locked' });
  });
});
