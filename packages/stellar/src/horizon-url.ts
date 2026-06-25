/**
 * Horizon server URL validation per network profile.
 *
 * Validates Horizon URLs against network-specific allowlist patterns
 * to prevent misconfiguration and security issues.
 */

import type { Network } from '@ancore/types';

/**
 * Error thrown when Horizon URL validation fails.
 */
export class HorizonUrlValidationError extends Error {
  public readonly code:
    | 'INVALID_URL'
    | 'INVALID_SCHEME'
    | 'INVALID_HOSTNAME'
    | 'NETWORK_MISMATCH'
    | 'LOCALHOST_NOT_ALLOWED';
  public readonly url: string;
  public readonly network: Network;

  constructor(
    code:
      | 'INVALID_URL'
      | 'INVALID_SCHEME'
      | 'INVALID_HOSTNAME'
      | 'NETWORK_MISMATCH'
      | 'LOCALHOST_NOT_ALLOWED',
    message: string,
    url: string,
    network: Network
  ) {
    super(message);
    this.name = 'HorizonUrlValidationError';
    this.code = code;
    this.url = url;
    this.network = network;
  }
}

/**
 * Network-specific Horizon URL profiles with validation rules.
 */
interface NetworkProfile {
  /** Allowed hostname patterns (exact string match or regex) */
  allowedHosts: (string | RegExp)[];
  /** Whether HTTPS is required */
  requireHttps: boolean;
  /** Whether localhost is allowed */
  allowLocalhost: boolean;
}

const NETWORK_PROFILES: Record<Network, NetworkProfile> = {
  mainnet: {
    allowedHosts: [
      'horizon.stellar.org',
      /^horizon-[a-z0-9-]+\.stellar\.org$/, // Allow subdomains like horizon-public
    ],
    requireHttps: true,
    allowLocalhost: false,
  },
  testnet: {
    allowedHosts: ['horizon-testnet.stellar.org', /^horizon-testnet-[a-z0-9-]+\.stellar\.org$/],
    requireHttps: true,
    allowLocalhost: false,
  },
  futurenet: {
    allowedHosts: ['horizon-futurenet.stellar.org', /^horizon-futurenet-[a-z0-9-]+\.stellar\.org$/],
    requireHttps: true,
    allowLocalhost: false,
  },
  local: {
    allowedHosts: ['localhost', '127.0.0.1', /^localhost:\d+$/, /^127\.0\.0\.1:\d+$/],
    requireHttps: false,
    allowLocalhost: true,
  },
};

/**
 * Validates a Horizon URL against the specified network profile.
 *
 * @param url - The Horizon URL to validate
 * @param network - The network to validate against
 * @throws {HorizonUrlValidationError} If the URL is invalid for the network
 *
 * @example
 * ```typescript
 * try {
 *   validateHorizonUrl('https://horizon.stellar.org', 'mainnet');
 *   // URL is valid
 * } catch (err) {
 *   if (err instanceof HorizonUrlValidationError) {
 *     console.error(`Invalid URL: ${err.message}`);
 *   }
 * }
 * ```
 */
export function validateHorizonUrl(url: string, network: Network): void {
  if (!url || typeof url !== 'string') {
    throw new HorizonUrlValidationError(
      'INVALID_URL',
      'URL must be a non-empty string',
      url,
      network
    );
  }

  const trimmedUrl = url.trim();
  if (trimmedUrl.length === 0) {
    throw new HorizonUrlValidationError('INVALID_URL', 'URL must not be empty', url, network);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    throw new HorizonUrlValidationError(
      'INVALID_URL',
      `Invalid URL format: "${url}"`,
      url,
      network
    );
  }

  const profile = NETWORK_PROFILES[network];

  // Check localhost before scheme — gives a more specific error for HTTP localhost
  if (
    !profile.allowLocalhost &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  ) {
    throw new HorizonUrlValidationError(
      'LOCALHOST_NOT_ALLOWED',
      `Localhost is not allowed for ${network}`,
      url,
      network
    );
  }

  // Validate scheme
  if (profile.requireHttps && parsed.protocol !== 'https:') {
    throw new HorizonUrlValidationError(
      'INVALID_SCHEME',
      `HTTPS is required for ${network}, got "${parsed.protocol}"`,
      url,
      network
    );
  }

  // Network mismatch detection: check if URL contains a known pattern for a different network.
  // Run before the hostname allowlist check so cross-network URLs get a specific error code.
  const urlLower = trimmedUrl.toLowerCase();
  const networkMismatchPatterns: Record<Network, RegExp[]> = {
    mainnet: [/testnet/i, /futurenet/i],
    testnet: [/futurenet/i],
    futurenet: [/testnet(?!net)/i],
    local: [],
  };

  // Also detect known mainnet hostname used on non-mainnet profiles
  const knownMainnetHostnames = ['horizon.stellar.org'];
  const knownTestnetHostnames = ['horizon-testnet.stellar.org'];
  const knownFuturenetHostnames = ['horizon-futurenet.stellar.org'];

  const hostname = parsed.hostname;

  const isKnownOtherNetwork =
    (network !== 'mainnet' && knownMainnetHostnames.includes(hostname)) ||
    (network !== 'testnet' && knownTestnetHostnames.includes(hostname)) ||
    (network !== 'futurenet' && knownFuturenetHostnames.includes(hostname));

  const mismatchPatterns = networkMismatchPatterns[network];
  const hasKeywordMismatch = mismatchPatterns.some((pattern) => pattern.test(urlLower));

  if (isKnownOtherNetwork || hasKeywordMismatch) {
    throw new HorizonUrlValidationError(
      'NETWORK_MISMATCH',
      `URL appears to belong to a different network than ${network}`,
      url,
      network
    );
  }

  // Validate hostname against allowed patterns
  const isAllowed = profile.allowedHosts.some((pattern) => {
    if (typeof pattern === 'string') {
      return hostname === pattern;
    }
    if (pattern instanceof RegExp) {
      return pattern.test(hostname);
    }
    return false;
  });

  if (!isAllowed) {
    throw new HorizonUrlValidationError(
      'INVALID_HOSTNAME',
      `Hostname "${hostname}" is not allowed for ${network}`,
      url,
      network
    );
  }
}

/**
 * Checks if a Horizon URL is valid without throwing.
 *
 * @param url - The Horizon URL to validate
 * @param network - The network to validate against
 * @returns true if valid, false otherwise
 */
export function isValidHorizonUrl(url: string, network: Network): boolean {
  try {
    validateHorizonUrl(url, network);
    return true;
  } catch {
    return false;
  }
}
