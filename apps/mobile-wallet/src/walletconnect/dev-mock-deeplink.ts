export interface DevMockWalletConnectRequest {
  method: string;
  params: unknown;
}

export const DEV_MOCK_WC_HOST = 'mock-wc';

const MOCK_WC_SCHEMES = ['ancoredev', 'ancore'] as const;

export const isDevMockWalletConnectDeepLink = (url: string): boolean => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return false;
  }

  return MOCK_WC_SCHEMES.some((scheme) => url.startsWith(`${scheme}://${DEV_MOCK_WC_HOST}?`));
};

export const parseDevMockWalletConnectDeepLink = (
  url: string
): DevMockWalletConnectRequest | null => {
  if (!isDevMockWalletConnectDeepLink(url)) {
    return null;
  }

  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return null;
  }

  const params = new URLSearchParams(url.slice(queryIndex + 1));
  const request = params.get('request');
  if (!request) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(request)) as DevMockWalletConnectRequest;
    if (!parsed?.method) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};
