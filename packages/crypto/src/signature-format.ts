import { Buffer } from 'node:buffer';

/**
 * Convert bytes to lowercase hex string with optional '0x' prefix
 * @param bytes - The bytes to convert
 * @param includePrefix - Whether to include '0x' prefix (default: false)
 * @returns Hex string representation
 */
export function toHex(bytes: Uint8Array, includePrefix = false): string {
  const hex = Buffer.from(bytes).toString('hex');
  return includePrefix ? `0x${hex}` : hex;
}

/**
 * Convert hex string (with optional '0x' prefix) to bytes
 * @param hex - The hex string to decode
 * @returns Uint8Array representation
 * @throws Error if hex string is invalid
 */
export function fromHex(hex: string): Uint8Array {
  const cleaned = hex.startsWith('0x') ? hex.slice(2) : hex;

  if (!isValidHex(cleaned)) {
    throw new Error(`Invalid hex string: ${hex}`);
  }

  return new Uint8Array(Buffer.from(cleaned, 'hex'));
}

/**
 * Convert bytes to base64 string
 * @param bytes - The bytes to convert
 * @returns Base64 string representation
 */
export function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

/**
 * Convert base64 string to bytes with automatic padding normalization
 * @param b64 - The base64 string to decode
 * @returns Uint8Array representation
 * @throws Error if base64 string is invalid
 */
export function fromBase64(b64: string): Uint8Array {
  const normalized = normalizePadding(b64);

  if (!isValidBase64(normalized)) {
    throw new Error(`Invalid base64 string: ${b64}`);
  }

  return new Uint8Array(Buffer.from(normalized, 'base64'));
}

/**
 * Encode signature bytes to a specific format
 * @param signature - The signature bytes
 * @param format - Target format: 'hex', 'base64', or 'raw'
 * @returns Encoded signature
 */
export function encodeSignature(
  signature: Uint8Array,
  format: 'hex' | 'base64' | 'raw' = 'hex'
): string | Uint8Array {
  switch (format) {
    case 'hex':
      return toHex(signature);
    case 'base64':
      return toBase64(signature);
    case 'raw':
      return signature;
    default:
      throw new Error(`Unsupported signature format: ${format}`);
  }
}

/**
 * Decode signature from any format to raw bytes
 * Automatically detects hex (with or without '0x'), base64, or raw Uint8Array
 * @param signature - The signature in any format
 * @returns Uint8Array representation
 * @throws Error if format cannot be determined or is invalid
 */
export function decodeSignature(signature: Uint8Array | string): Uint8Array {
  // Already raw bytes
  if (signature instanceof Uint8Array) {
    return signature;
  }

  // Try hex first (with or without 0x prefix)
  if (isValidHex(signature) || signature.startsWith('0x')) {
    try {
      return fromHex(signature);
    } catch {
      // Not valid hex, try base64
    }
  }

  // Try base64
  if (isValidBase64(signature)) {
    try {
      return fromBase64(signature);
    } catch {
      // Not valid base64 either
    }
  }

  throw new Error(
    `Unable to detect signature format. Expected hex, base64, or Uint8Array, got: ${signature}`
  );
}

/**
 * Check if a string is valid hex
 * @internal
 */
export function isValidHex(value: string): boolean {
  const cleaned = value.startsWith('0x') ? value.slice(2) : value;
  if (cleaned.length % 2 !== 0) return false;
  return /^[0-9a-fA-F]*$/.test(cleaned);
}

/**
 * Check if a string is valid base64
 * @internal
 */
export function isValidBase64(value: string): boolean {
  // Base64 regex: alphanumeric, +, /, and = for padding
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$|^[A-Za-z0-9+/]+={0,2}$/;
  return base64Regex.test(value) && value.length % 4 === 0;
}

/**
 * Normalize base64 string padding
 * @internal
 */
function normalizePadding(b64: string): string {
  const remainder = b64.length % 4;
  if (remainder === 0) return b64;
  return b64 + '='.repeat(4 - remainder);
}
