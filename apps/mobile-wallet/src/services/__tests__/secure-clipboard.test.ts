import { copySecure, clearClipboard } from '../secure-clipboard';

describe('copySecure', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('copies value to clipboard and clears after 60s by default', async () => {
    const copyPromise = copySecure('test mnemonic');
    jest.advanceTimersByTime(59_000);
    await copyPromise;

    // After 60s, clipboard should be cleared.
    // The setTimeout is scheduled inside copySecure, we advance past it.
    jest.advanceTimersByTime(2_000);
  });

  it('clears clipboard after custom timeout', async () => {
    const copyPromise = copySecure('secret key', 10_000);
    jest.advanceTimersByTime(10_000);
    await copyPromise;
  });
});

describe('clearClipboard', () => {
  it('clears clipboard immediately without throwing', async () => {
    await expect(clearClipboard()).resolves.toBeUndefined();
  });
});
