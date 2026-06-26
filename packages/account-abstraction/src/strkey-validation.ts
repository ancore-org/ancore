import { StrKey } from '@stellar/stellar-sdk';

export type StrKeyErrorCode = 'INVALID_G_KEY' | 'INVALID_C_KEY';

export class StrKeyValidationError extends Error {
  readonly code: StrKeyErrorCode;

  constructor(
    code: StrKeyErrorCode,
    message: string,
    readonly input?: string
  ) {
    super(message);
    this.name = 'StrKeyValidationError';
    this.code = code;
  }
}

export function assertValidEd25519PublicKey(publicKey: string): void {
  if (typeof publicKey !== 'string' || !StrKey.isValidEd25519PublicKey(publicKey)) {
    const snippet =
      typeof publicKey === 'string' ? `${publicKey.slice(0, 8)}...` : String(publicKey);
    throw new StrKeyValidationError(
      'INVALID_G_KEY',
      `Invalid Ed25519 public key: expected G... format, got ${snippet}`,
      typeof publicKey === 'string' ? publicKey : undefined
    );
  }
}
