/**
 * WalletConnect deep link handler
 *
 * Handles deep links for WalletConnect pairing URIs in the format:
 * ancore://wc?uri=<pairing-uri>
 *
 * The pairing URI is extracted and passed to WalletKit.pair() to establish
 * a connection with a dApp.
 */

export interface WalletConnectDeepLinkParams {
  uri: string;
}

/**
 * Parse a WalletConnect deep link URL
 * @param url - The deep link URL (e.g., ancore://wc?uri=wc:abc...)
 * @returns The parsed parameters or null if invalid
 */
export const parseWalletConnectDeepLink = (url: string): WalletConnectDeepLinkParams | null => {
  try {
    // Validate URL format
    if (!url.startsWith('ancore://wc?uri=')) {
      return null;
    }

    // Extract everything after uri= - the WalletConnect URI may contain its own query params
    const uri = url.substring('ancore://wc?uri='.length);

    // Validate that it's a WalletConnect URI
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
 * Check if a URL is a WalletConnect deep link
 * @param url - The URL to check
 * @returns True if the URL is a WalletConnect deep link
 */
export const isWalletConnectDeepLink = (url: string): boolean => {
  return url.startsWith('ancore://wc?');
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
