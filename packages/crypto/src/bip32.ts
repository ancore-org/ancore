/**
 * BIP32 Path Validation & Stellar Derivation Helpers (#1451, #1453).
 *
 * Implements strict hierarchical deterministic (HD) path validation according to
 * BIP32/BIP44 specifications and provides convenience helpers for standard Stellar
 * account and session key derivation.
 */

export const STELLAR_COIN_TYPE = 148;
export const BIP44_PURPOSE = 44;
export const MAX_BIP32_INDEX = 0x7fffffff; // 2^31 - 1

export class BIP32PathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BIP32PathError';
  }
}

export interface BIP32PathSegment {
  index: number;
  hardened: boolean;
}

export interface ParsedBIP32Path {
  valid: boolean;
  segments: BIP32PathSegment[];
  error?: string;
}

/**
 * Parses a BIP32 derivation path string into its component segments.
 *
 * Valid formats:
 * - "m" (master node)
 * - "m/44'/148'/0'"
 * - "m/44'/148'/0'/0/0"
 * Hardened indices can use either ' or h suffix (e.g. 44' or 44h).
 */
export function parseBIP32Path(path: string): ParsedBIP32Path {
  if (typeof path !== 'string' || path.trim() === '') {
    return { valid: false, segments: [], error: 'Path must be a non-empty string' };
  }

  const trimmed = path.trim();
  const parts = trimmed.split('/');

  if (parts[0] !== 'm') {
    return { valid: false, segments: [], error: 'Path must begin with "m"' };
  }

  if (parts.length === 1) {
    return { valid: true, segments: [] };
  }

  const segments: BIP32PathSegment[] = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part === '') {
      return { valid: false, segments: [], error: `Empty path segment at index ${i}` };
    }

    const isHardened = part.endsWith("'") || part.endsWith('h');
    const numStr = isHardened ? part.slice(0, -1) : part;

    if (!/^\d+$/.test(numStr)) {
      return { valid: false, segments: [], error: `Invalid segment number: "${part}"` };
    }

    const index = parseInt(numStr, 10);
    if (index > MAX_BIP32_INDEX) {
      return {
        valid: false,
        segments: [],
        error: `Index ${index} exceeds maximum BIP32 index ${MAX_BIP32_INDEX}`,
      };
    }

    segments.push({ index, hardened: isHardened });
  }

  return { valid: true, segments };
}

/**
 * Validates whether a path conforms to BIP32 specification.
 */
export function isValidBIP32Path(path: string): boolean {
  return parseBIP32Path(path).valid;
}

/**
 * Checks whether a derivation path matches standard Stellar BIP44 conventions:
 * Standard root pattern: m/44'/148'/{account}'
 * Extended pattern: m/44'/148'/{account}'/{change}'/{index}'
 */
export function isStandardStellarPath(path: string): boolean {
  const parsed = parseBIP32Path(path);
  if (!parsed.valid || parsed.segments.length < 3) {
    return false;
  }

  const [purpose, coinType, account, ...rest] = parsed.segments;

  if (
    purpose.index !== BIP44_PURPOSE ||
    !purpose.hardened ||
    coinType.index !== STELLAR_COIN_TYPE ||
    !coinType.hardened ||
    !account.hardened
  ) {
    return false;
  }

  // If there are additional sub-indices (change / address), ensure they are valid
  if (rest.length > 2) {
    return false;
  }

  return true;
}

/**
 * Generates the canonical BIP44 derivation path for a Stellar primary account.
 * Formula: m/44'/148'/{accountIndex}'
 *
 * @param accountIndex - Non-negative integer (0-based)
 */
export function deriveMainAccountPath(accountIndex = 0): string {
  if (accountIndex < 0 || !Number.isInteger(accountIndex) || accountIndex > MAX_BIP32_INDEX) {
    throw new BIP32PathError(
      `Account index must be an integer between 0 and ${MAX_BIP32_INDEX}, got ${accountIndex}`
    );
  }
  return `m/44'/148'/${accountIndex}'`;
}

/**
 * Generates a standard derivation path for delegated session keys.
 * Formula: m/44'/148'/{accountIndex}'/2'/{sessionIndex}'
 * (index 2' is used for session delegation)
 *
 * @param sessionIndex - Non-negative integer
 * @param accountIndex - Parent account index (default: 0)
 */
export function deriveSessionKeyPath(sessionIndex = 0, accountIndex = 0): string {
  if (sessionIndex < 0 || !Number.isInteger(sessionIndex) || sessionIndex > MAX_BIP32_INDEX) {
    throw new BIP32PathError(
      `Session index must be an integer between 0 and ${MAX_BIP32_INDEX}, got ${sessionIndex}`
    );
  }
  if (accountIndex < 0 || !Number.isInteger(accountIndex) || accountIndex > MAX_BIP32_INDEX) {
    throw new BIP32PathError(
      `Account index must be an integer between 0 and ${MAX_BIP32_INDEX}, got ${accountIndex}`
    );
  }
  return `m/44'/148'/${accountIndex}'/2'/${sessionIndex}'`;
}

/**
 * Formats an array of segments into a canonical BIP32 path string.
 */
export function formatBIP32Path(segments: BIP32PathSegment[]): string {
  if (segments.length === 0) return 'm';
  const parts = segments.map((s) => `${s.index}${s.hardened ? "'" : ''}`);
  return `m/${parts.join('/')}`;
}
