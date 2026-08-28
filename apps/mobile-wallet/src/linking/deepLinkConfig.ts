import { parseWalletConnectDeepLink, getWalletConnectDeepLinkPrefixes } from './walletconnect';

/** @deprecated Import from `./walletconnect` — kept for backward compatibility. */
export { ANCORE_URL_SCHEME } from './walletconnect';

/** Deep link prefix for React Navigation `linking.prefixes`. */
export const ANCORE_DEEP_LINK_PREFIX = 'ancore://';

const walletConnectPrefixes = getWalletConnectDeepLinkPrefixes();

/**
 * React Navigation linking config for WalletConnect pairing deep links.
 *
 * Maps `ancore://wc?uri=<wc-pairing-uri>` to the `WCPairing` screen.
 * Use with `NavigationContainer` in the host app:
 *
 * ```tsx
 * <NavigationContainer linking={mobileWalletDeepLinking}>
 * ```
 */
export const mobileWalletDeepLinking = {
  prefixes: walletConnectPrefixes,
  config: {
    screens: {
      WCPairing: 'wc',
    },
  },
  getStateFromPath(path: string) {
    const candidates = [
      path,
      path.startsWith(ANCORE_DEEP_LINK_PREFIX) ? path : `${ANCORE_DEEP_LINK_PREFIX}${path}`,
    ];

    for (const candidate of candidates) {
      const navigationState = getWalletConnectNavigationState(candidate);
      if (navigationState) {
        return navigationState;
      }
    }

    return undefined;
  },
};

export type WalletConnectNavigationState = {
  routes: Array<{ name: 'WCPairing'; params: { uri: string } }>;
};

/**
 * Resolve a WalletConnect deep link URL into a React Navigation state object.
 * Handles complex pairing URIs that contain nested query parameters.
 */
export function getWalletConnectNavigationState(
  url: string
): WalletConnectNavigationState | undefined {
  const parsed = parseWalletConnectDeepLink(normalizeDeepLinkUrl(url));
  if (!parsed) {
    return undefined;
  }

  return {
    routes: [{ name: 'WCPairing', params: { uri: parsed.uri } }],
  };
}

function normalizeDeepLinkUrl(input: string): string {
  if (input.startsWith(ANCORE_DEEP_LINK_PREFIX)) {
    return input;
  }

  return `${ANCORE_DEEP_LINK_PREFIX}${input}`;
}
