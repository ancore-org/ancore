import {
  ANCORE_DEEP_LINK_PREFIX,
  getWalletConnectNavigationState,
  mobileWalletDeepLinking,
} from '../deepLinkConfig';

describe('mobileWalletDeepLinking', () => {
  it('registers the ancore:// prefix and WCPairing screen path', () => {
    expect(mobileWalletDeepLinking.prefixes).toEqual([ANCORE_DEEP_LINK_PREFIX]);
    expect(mobileWalletDeepLinking.config.screens.WCPairing).toBe('wc');
  });

  it('resolves navigation state from a full deep link URL', () => {
    const url = 'ancore://wc?uri=wc:abc123def456';

    expect(getWalletConnectNavigationState(url)).toEqual({
      routes: [{ name: 'WCPairing', params: { uri: 'wc:abc123def456' } }],
    });
  });

  it('resolves navigation state for complex pairing URIs', () => {
    const url = 'ancore://wc?uri=wc:abc123@2?relay-protocol=irn&symKey=xyz789';

    expect(getWalletConnectNavigationState(url)).toEqual({
      routes: [
        {
          name: 'WCPairing',
          params: { uri: 'wc:abc123@2?relay-protocol=irn&symKey=xyz789' },
        },
      ],
    });
  });

  it('uses getStateFromPath for path-only deep links', () => {
    const path = 'wc?uri=wc:abc123def456';

    expect(mobileWalletDeepLinking.getStateFromPath(path)).toEqual({
      routes: [{ name: 'WCPairing', params: { uri: 'wc:abc123def456' } }],
    });
  });

  it('returns undefined for unrelated paths', () => {
    expect(getWalletConnectNavigationState('ancore://payment?amount=100')).toBeUndefined();
    expect(mobileWalletDeepLinking.getStateFromPath('payment?amount=100')).toBeUndefined();
  });
});
