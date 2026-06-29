import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import type { IBiometricAuthService } from './hooks/useBiometricUnlock';
import type { BiometricFailureReason } from './biometric-lockout.types';

export class NativeBiometricAdapter implements IBiometricAuthService {
  private rnBiometrics: ReactNativeBiometrics;

  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await this.rnBiometrics.isSensorAvailable();
      return available;
    } catch {
      return false;
    }
  }

  async authenticate(promptMessage: string): Promise<{
    success: boolean;
    error?: string;
    errorCode?: BiometricFailureReason;
  }> {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      if (!available) {
        return { success: false, errorCode: 'BIOMETRIC_NOT_AVAILABLE' };
      }

      // We use createKeys and createSignature as requested in issue #847
      // But simplePrompt can also be used.
      // "Implement NativeBiometricAdapter that checks isSensorAvailable(), calls simplePrompt() for unlock
      // Store vault password encrypted behind biometric key: use createKeys() + createSignature() for verification"

      const payload = 'ancore_vault_unlock_payload';
      const { keysExist } = await this.rnBiometrics.biometricKeysExist();
      if (!keysExist) {
        await this.rnBiometrics.createKeys();
      }

      const { success, signature } = await this.rnBiometrics.createSignature({
        promptMessage,
        payload,
      });

      if (success && signature) {
        return { success: true };
      }

      return { success: false, errorCode: 'USER_CANCEL' };
    } catch (err: unknown) {
      if (err instanceof Error && err.message && err.message.includes('User cancelled')) {
        return { success: false, errorCode: 'USER_CANCEL' };
      }
      return { success: false, errorCode: 'AUTHENTICATION_FAILED' };
    }
  }
}
