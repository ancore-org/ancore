import type { IBiometricAuthService } from './hooks/useBiometricUnlock';
import type { BiometricFailureReason } from './biometric-lockout.types';

export type AuthenticationResult = {
  success: boolean;
  errorCode?: BiometricFailureReason;
  error?: string;
  fallbackToPin?: boolean;
};

export type AuthenticateWithBiometricsOptions = {
  promptMessage?: string;
  fallbackToPin?: boolean;
};

/**
 * Unified helper for biometric authentication with automatic fallback handling.
 * 
 * Wraps biometric prompts with fallback to device PIN when:
 * - Hardware is unavailable
 * - User cancels authentication
 * - Authentication fails
 * 
 * @param biometricService - The biometric service adapter
 * @param options - Configuration options
 * @returns Authentication result with success status and error details
 * 
 * @example
 * ```ts
 * const result = await authenticateWithBiometrics(biometricService, {
 *   promptMessage: 'Unlock wallet',
 *   fallbackToPin: true
 * });
 * 
 * if (result.success) {
 *   // Proceed with authenticated action
 * } else if (result.fallbackToPin) {
 *   // Show PIN entry screen
 * } else {
 *   // Handle error
 * }
 * ```
 */
export async function authenticateWithBiometrics(
  biometricService: IBiometricAuthService,
  options: AuthenticateWithBiometricsOptions = {}
): Promise<AuthenticationResult> {
  const {
    promptMessage = 'Authenticate to continue',
    fallbackToPin = true,
  } = options;

  // Check if biometrics are available
  const isAvailable = await biometricService.isAvailable();
  
  if (!isAvailable) {
    if (fallbackToPin) {
      return {
        success: false,
        errorCode: 'BIOMETRIC_NOT_AVAILABLE',
        error: 'Biometric authentication is not available on this device',
        fallbackToPin: true,
      };
    }
    
    return {
      success: false,
      errorCode: 'BIOMETRIC_NOT_AVAILABLE',
      error: 'Biometric authentication is not available on this device',
    };
  }

  // Attempt authentication
  const authResult = await biometricService.authenticate(promptMessage);

  if (authResult.success) {
    return {
      success: true,
    };
  }

  // Handle authentication failure
  const shouldFallback = fallbackToPin && (
    authResult.errorCode === 'USER_CANCEL' ||
    authResult.errorCode === 'AUTHENTICATION_FAILED' ||
    authResult.errorCode === 'BIOMETRIC_NOT_AVAILABLE'
  );

  return {
    success: false,
    errorCode: authResult.errorCode,
    error: authResult.error,
    fallbackToPin: shouldFallback,
  };
}
