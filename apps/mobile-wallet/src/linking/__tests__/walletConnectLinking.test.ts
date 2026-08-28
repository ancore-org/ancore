import { subscribeToWalletConnectDeepLinks } from '../walletConnectLinking';

const mockGetInitialURL = jest.fn<Promise<string | null>, []>();
const mockAddEventListener = jest.fn();

jest.mock(
  'react-native',
  () => ({
    Linking: {
      getInitialURL: (...args: []) => mockGetInitialURL(...args),
      addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
    },
  }),
  { virtual: true }
);

describe('subscribeToWalletConnectDeepLinks', () => {
  let urlHandler: ((event: { url: string }) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    urlHandler = undefined;

    mockAddEventListener.mockImplementation((_type, handler) => {
      urlHandler = handler as (event: { url: string }) => void;
      return { remove: jest.fn() };
    });
  });

  it('handles cold-start deep links from Linking.getInitialURL', async () => {
    const mockUri = 'ancore://wc?uri=wc:abc123def456';
    mockGetInitialURL.mockResolvedValue(mockUri);

    const onDeepLink = jest.fn();
    subscribeToWalletConnectDeepLinks(onDeepLink);

    await Promise.resolve();

    expect(mockGetInitialURL).toHaveBeenCalled();
    expect(onDeepLink).toHaveBeenCalledWith({ uri: 'wc:abc123def456' });
  });

  it('handles warm-start deep links from Linking url events', () => {
    const onDeepLink = jest.fn();
    subscribeToWalletConnectDeepLinks(onDeepLink);

    const mockUri = 'ancore://wc?uri=wc:abc123@2?relay-protocol=irn&symKey=xyz789';
    urlHandler?.({ url: mockUri });

    expect(mockAddEventListener).toHaveBeenCalledWith('url', expect.any(Function));
    expect(onDeepLink).toHaveBeenCalledWith({
      uri: 'wc:abc123@2?relay-protocol=irn&symKey=xyz789',
    });
  });

  it('ignores non-WalletConnect URLs', async () => {
    mockGetInitialURL.mockResolvedValue('ancore://payment?amount=100');

    const onDeepLink = jest.fn();
    subscribeToWalletConnectDeepLinks(onDeepLink);

    await Promise.resolve();

    expect(onDeepLink).not.toHaveBeenCalled();
  });

  it('removes the url event listener on unsubscribe', () => {
    const remove = jest.fn();
    mockAddEventListener.mockReturnValue({ remove });

    const subscription = subscribeToWalletConnectDeepLinks(jest.fn());
    subscription.remove();

    expect(remove).toHaveBeenCalled();
  });
});
