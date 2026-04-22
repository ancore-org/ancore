/**
 * Core encryption primitives for @ancore/core-sdk
 * Implements PBKDF2 key derivation and AES-GCM encryption/decryption
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AES_KEY_LENGTH = 256;

export interface EncryptedPayload {
  /** Base64-encoded salt for PBKDF2 key derivation */
  salt: string;
  /** Base64-encoded initialization vector for AES-GCM */
  iv: string;
  /** Base64-encoded ciphertext (includes auth tag) */
  ciphertext: string;
}

/**
 * Derive an encryption key from a password using PBKDF2
 *
 * @param password - The password to derive from
 * @param salt - The salt bytes (typically 16 bytes)
 * @param iterations - Number of PBKDF2 iterations (default: 100000)
 * @returns A CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto API is not available in this environment');
  }

  if (iterations < PBKDF2_ITERATIONS) {
    throw new Error(`Iterations must be at least ${PBKDF2_ITERATIONS}`);
  }

  const passwordKey = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plaintext using AES-GCM with a derived key
 *
 * @param plaintext - The data to encrypt
 * @param password - The password to derive the encryption key from
 * @returns An encrypted payload with salt, IV, and ciphertext (all base64-encoded)
 */
export async function encrypt(plaintext: string, password: string): Promise<EncryptedPayload> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto API is not available in this environment');
  }

  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string');
  }

  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  // Generate random salt and IV
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive encryption key
  const key = await deriveKey(password, salt);

  // Encrypt the plaintext
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertext),
  };
}

/**
 * Decrypt an encrypted payload using AES-GCM with a derived key
 *
 * @param payload - The encrypted payload with salt, IV, and ciphertext
 * @param password - The password to derive the decryption key from
 * @returns The decrypted plaintext
 * @throws Error if the password is incorrect or the payload is corrupted
 */
export async function decrypt(payload: EncryptedPayload, password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto API is not available in this environment');
  }

  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Password must be a non-empty string');
  }

  try {
    // Decode base64 components
    const salt = base64ToBuffer(payload.salt);
    const iv = base64ToBuffer(payload.iv);
    const ciphertext = base64ToBuffer(payload.ciphertext);

    // Derive decryption key
    const key = await deriveKey(password, salt);

    // Decrypt the ciphertext
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    // Catch auth tag verification failures and other decryption errors
    throw new Error('Invalid password or corrupted encrypted payload');
  }
}

/**
 * Convert a buffer to base64 string
 */
function bufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return globalThis.btoa(binary);
}

/**
 * Convert a base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
