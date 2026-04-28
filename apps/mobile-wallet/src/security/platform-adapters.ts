
import type { IBiometricAuthService, IPasswordAuthService } from './hooks/useBiometricUnlock';
import type { BiometricFailureReason } from './biometric-lockout.types';
import type { SecureStoreAdapter } from '../storage/types';


function decodeBase64Url(input: string): ArrayBuffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);

  for (let i = 0; i < binary.length; i += 1) {
    view[i] = binary.charCodeAt(i);
  }

  return buffer;
}

export class WebAuthnBiometricService implements IBiometricAuthService {
  private rpId: string;
  private credentialId: string | null;

  constructor(rpId: string, credentialId: string | null = null) {
    this.rpId = rpId;
    this.credentialId = credentialId;
  }

  async isAvailable(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  async authenticate(_promptMessage: string): Promise<{
    success: boolean;
    errorCode?: BiometricFailureReason;
  }> {
    if (!this.credentialId) {
      return { success: false, errorCode: 'BIOMETRIC_NOT_ENROLLED' };
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: this.rpId,
          allowCredentials: [
            {
              id: decodeBase64Url(this.credentialId),
              type: 'public-key',
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60_000,
        },
      });

      return { success: true };
    } catch (err) {
      return { success: false, errorCode: mapWebAuthnError(err) };
    }
  }
}

function mapWebAuthnError(err: unknown): BiometricFailureReason {
  if (!(err instanceof Error)) return 'UNKNOWN';

  // NotAllowedError covers: user dismissal, timeout, lockout
  if (err.name === 'NotAllowedError') {
    if (err.message.toLowerCase().includes('cancel')) return 'USER_CANCEL';
    // Browsers don't expose lockout directly; treat timeout/dismissal as cancel
    return 'USER_CANCEL';
  }

  if (err.name === 'InvalidStateError') return 'BIOMETRIC_NOT_ENROLLED';
  if (err.name === 'NotSupportedError') return 'BIOMETRIC_NOT_AVAILABLE';
  if (err.name === 'SecurityError') return 'AUTHENTICATION_FAILED';

  return 'UNKNOWN';
}

// Password auth adapter 
export class WalletPasswordAuthService implements IPasswordAuthService {
  private verifyPassword: (pw: string) => Promise<boolean>;

  constructor(verifyFn: (pw: string) => Promise<boolean>) {
    this.verifyPassword = verifyFn;
  }

  async authenticate(password: string): Promise<boolean> {
    return this.verifyPassword(password);
  }
}

// Secure storage adapter 
export function makeSecureStorageAdapter(store: SecureStoreAdapter) {
  return {
    getItem: (key: string) => store.get<string>(key),
    setItem: (key: string, value: string) => store.set<string>(key, value),
    removeItem: (key: string) => store.remove(key),
  };
}

