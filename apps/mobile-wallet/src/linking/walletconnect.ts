/**
 * WalletConnect deep link handler
 *
 * Handles deep links for WalletConnect pairing URIs in the format:
 * {scheme}://wc?uri=<pairing-uri>
 *
 * The pairing URI may be percent-encoded, since it contains ':', '@', '?' and
 * '&'; it is decoded before validation.
 *
 * The pairing URI is extracted and passed to WalletKit.pair() to establish
 * a connection with a dApp.
 */

export interface WalletConnectDeepLinkParams {
  uri: string;
}

export const ANCORE_URL_SCHEME = 'ancore';
export const ANCORE_DEV_URL_SCHEME = 'ancoredev';

const SUPPORTED_WC_SCHEMES = [ANCORE_URL_SCHEME, ANCORE_DEV_URL_SCHEME] as const;

const WC_DEEP_LINK_PREFIXES = SUPPORTED_WC_SCHEMES.map((scheme) => `${scheme}://wc?uri=`);

export const isWalletConnectDeepLink = (url: string): boolean =>
  WC_DEEP_LINK_PREFIXES.some((prefix) => url.startsWith(prefix));

/**
 * Parse a WalletConnect deep link URL
 * @param url - The deep link URL (e.g., ancore://wc?uri=wc:abc...)
 * @returns The parsed parameters or null if invalid
 */
export const parseWalletConnectDeepLink = (url: string): WalletConnectDeepLinkParams | null => {
  try {
    const prefix = WC_DEEP_LINK_PREFIXES.find((candidate) => url.startsWith(candidate));
    if (!prefix) {
      return null;
    }

    const rawUri = url.substring(prefix.length);

    // A correctly built deep link percent-encodes the pairing URI, because it
    // contains ':', '@', '?' and '&'. Decode it before validating. Links that
    // were never encoded still work: decodeURIComponent is a no-op on them, and
    // a malformed escape sequence falls back to the raw value rather than
    // rejecting an otherwise usable link.
    let uri: string;
    try {
      uri = decodeURIComponent(rawUri);
    } catch {
      uri = rawUri;
    }

    if (!uri.startsWith('wc:')) {
      return null;
    }

    return { uri };
  } catch (error) {
    console.error('Failed to parse WalletConnect deep link:', error);
    return null;
  }
};

/**
 * Extract the pairing URI from a WalletConnect deep link
 * @param url - The deep link URL
 * @returns The pairing URI or null if invalid
 */
export const extractPairingUri = (url: string): string | null => {
  const params = parseWalletConnectDeepLink(url);
  return params?.uri || null;
};

export const getWalletConnectDeepLinkPrefixes = (): string[] => [
  `${ANCORE_URL_SCHEME}://`,
  `${ANCORE_DEV_URL_SCHEME}://`,
];
