/**
 * Local session-key type used by the account-abstraction package.
 * Kept aligned with the shared @ancore/types shape so this package can build independently.
 */

export interface SessionKey {
  publicKey: string;
  permissions: number[];
  expiresAt: number;
  label?: string;
}
