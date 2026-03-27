import { Buffer } from 'node:buffer';

const PBKDF2_ITERATIONS = 100000;
const MAX_PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const AES_KEY_LENGTH = 256;
const VERSION = 1;
const DECRYPT_FAILURE_MESSAGE = 'Invalid password or corrupted encrypted payload.';

export interface EncryptedSecretKeyPayload {
  version: number;
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto API is not available in this environment.');
  }

  return globalThis.crypto;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Buffer.from(view).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'base64'));
}

async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
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
      salt,
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
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }

  const record = payload as Record<string, unknown>;

  if (record.version !== VERSION) {
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }

  if (typeof record.salt !== 'string' || record.salt.length === 0) {
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }

  if (typeof record.iv !== 'string' || record.iv.length === 0) {
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }

  if (typeof record.ciphertext !== 'string' || record.ciphertext.length === 0) {
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }

  if (
    !Number.isSafeInteger(record.iterations) ||
    (record.iterations as number) < PBKDF2_ITERATIONS ||
    (record.iterations as number) > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }

  return {
    version: record.version as number,
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
      iv,
    },
    encryptionKey,
    new TextEncoder().encode(secretKey)
  );

  return {
    version: VERSION,
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
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
    const encryptionKey = await deriveEncryptionKey(
      password,
      salt,
      validatedPayload.iterations
    );

    const plaintext = await cryptoApi.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      encryptionKey,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error(DECRYPT_FAILURE_MESSAGE);
  }
}
