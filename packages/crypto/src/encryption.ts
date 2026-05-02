/* eslint-disable no-undef */
import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { toBase64, fromBase64 } from './signature-format';

const PBKDF2_ITERATIONS = 100000;
const MAX_PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AES_KEY_LENGTH = 256;
const VERSION = 1;
const DECRYPT_FAILURE_MESSAGE = 'Invalid password or corrupted encrypted payload.';

// Supported encryption payload versions
const SUPPORTED_VERSIONS = [1] as const;
type SupportedVersion = (typeof SUPPORTED_VERSIONS)[number];

// Error classes for better error handling
export class UnsupportedVersionError extends Error {
  constructor(
    public readonly detectedVersion: number,
    public readonly supportedVersions: readonly number[]
  ) {
    super(
      `Unsupported encryption payload version: ${detectedVersion}. Supported versions: [${supportedVersions.join(', ')}]`
    );
    this.name = 'UnsupportedVersionError';
  }
}

export class InvalidPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPayloadError';
  }
}

export interface EncryptedSecretKeyPayload {
  version: SupportedVersion;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function asBufferSource(value: Uint8Array): BufferSource {
  return value as unknown as BufferSource;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto API is not available in this environment.');
  }

  return globalThis.crypto;
}

async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<webcrypto.CryptoKey> {
  const cryptoApi = getCrypto();
  const passwordKey = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

function validateInputs(secretKey: string, password: string): void {
  if (typeof secretKey !== 'string' || secretKey.length === 0) {
    throw new Error('secretKey must be a non-empty string.');
  }

  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('password must be a non-empty string.');
  }
}

function validateEncryptedPayload(payload: unknown): EncryptedSecretKeyPayload {
  if (!payload || typeof payload !== 'object') {
    throw new InvalidPayloadError('Payload must be a non-null object');
  }

  const record = payload as Record<string, unknown>;

  // Validate version first to provide specific error for unsupported versions
  if (typeof record.version !== 'number' || !Number.isSafeInteger(record.version)) {
    throw new InvalidPayloadError('Payload version must be a safe integer');
  }

  if (!SUPPORTED_VERSIONS.includes(record.version as SupportedVersion)) {
    throw new UnsupportedVersionError(record.version, SUPPORTED_VERSIONS);
  }

  // Validate other required fields
  if (typeof record.salt !== 'string' || record.salt.length === 0) {
    throw new InvalidPayloadError('Payload salt must be a non-empty string');
  }

  if (typeof record.iv !== 'string' || record.iv.length === 0) {
    throw new InvalidPayloadError('Payload iv must be a non-empty string');
  }

  if (typeof record.ciphertext !== 'string' || record.ciphertext.length === 0) {
    throw new InvalidPayloadError('Payload ciphertext must be a non-empty string');
  }

  if (
    !Number.isSafeInteger(record.iterations) ||
    (record.iterations as number) < PBKDF2_ITERATIONS ||
    (record.iterations as number) > MAX_PBKDF2_ITERATIONS
  ) {
    throw new InvalidPayloadError(
      `Payload iterations must be a safe integer between ${PBKDF2_ITERATIONS} and ${MAX_PBKDF2_ITERATIONS}`
    );
  }

  return {
    version: record.version as SupportedVersion,
    iterations: record.iterations as number,
    salt: record.salt,
    iv: record.iv,
    ciphertext: record.ciphertext,
  };
}

/**
 * Encrypts a secret key using a password-derived AES-256-GCM key.
 *
 * The returned payload includes salt and IV for later decryption.
 */
export async function encryptSecretKey(
  secretKey: string,
  password: string
): Promise<EncryptedSecretKeyPayload> {
  validateInputs(secretKey, password);

  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = cryptoApi.getRandomValues(new Uint8Array(IV_LENGTH));
  const encryptionKey = await deriveEncryptionKey(password, salt, PBKDF2_ITERATIONS);

  const ciphertext = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: asBufferSource(iv),
    },
    encryptionKey,
    new TextEncoder().encode(secretKey)
  );

  return {
    version: VERSION as SupportedVersion,
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/**
 * Decrypts an encrypted secret key payload with the provided password.
 */
export async function decryptSecretKey(
  payload: EncryptedSecretKeyPayload,
  password: string
): Promise<string> {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('password must be a non-empty string.');
  }

  try {
    const validatedPayload = validateEncryptedPayload(payload);
    const cryptoApi = getCrypto();
    const salt = fromBase64(validatedPayload.salt);
    const iv = fromBase64(validatedPayload.iv);
    const ciphertext = fromBase64(validatedPayload.ciphertext);
    const encryptionKey = await deriveEncryptionKey(password, salt, validatedPayload.iterations);

    const plaintext = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: asBufferSource(iv),
      },
      encryptionKey,
      asBufferSource(ciphertext)
    );

    return new TextDecoder().decode(plaintext);
  } catch (error) {
    // Re-throw our custom errors as-is
    if (error instanceof UnsupportedVersionError || error instanceof InvalidPayloadError) {
      throw error;
    }

    // Wrap other errors as generic decryption failure
    throw new InvalidPayloadError(DECRYPT_FAILURE_MESSAGE);
  }
}
