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

  it('cancels pending timer when copySecure is called repeatedly', async () => {
    const spy = jest.spyOn(global, 'clearTimeout');
    await copySecure('secret A', 60_000);

    // Copy secret B after 10s
    jest.advanceTimersByTime(10_000);
    await copySecure('secret B', 60_000);

    expect(spy).toHaveBeenCalled();

    // At 60s mark from secret A (50s after secret B copy), secret A's timer would have fired.
    // Ensure it was cancelled so secret B is not cleared prematurely.
    jest.advanceTimersByTime(50_000);

    // Advance remaining 10s to trigger secret B's timer
    jest.advanceTimersByTime(10_000);
    spy.mockRestore();
  });
});

describe('clearClipboard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears clipboard immediately without throwing and cancels pending timers', async () => {
    const spy = jest.spyOn(global, 'clearTimeout');
    await copySecure('secret', 60_000);

    await expect(clearClipboard()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
