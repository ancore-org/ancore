import { authenticateWithBiometrics } from '../authenticateWithBiometrics';
import type { IBiometricAuthService } from '../hooks/useBiometricUnlock';

describe('authenticateWithBiometrics', () => {
  const createMockService = (): IBiometricAuthService => ({
    isAvailable: vi.fn(),
    authenticate: vi.fn(),
  });

  describe('when biometrics are available', () => {
    it('returns success when authentication succeeds', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (service.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      const result = await authenticateWithBiometrics(service, {
        promptMessage: 'Unlock wallet',
      });

      expect(result.success).toBe(true);
      expect(result.errorCode).toBeUndefined();
      expect(service.authenticate).toHaveBeenCalledWith('Unlock wallet');
    });

    it('uses default prompt message when none provided', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (service.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });

      await authenticateWithBiometrics(service);

      expect(service.authenticate).toHaveBeenCalledWith('Authenticate to continue');
    });

    it('returns failure with fallback when user cancels', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (service.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        errorCode: 'USER_CANCEL',
      });

      const result = await authenticateWithBiometrics(service, { fallbackToPin: true });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('USER_CANCEL');
      expect(result.fallbackToPin).toBe(true);
    });

    it('returns failure with fallback when authentication fails', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (service.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        errorCode: 'AUTHENTICATION_FAILED',
        error: 'Biometric not recognized',
      });

      const result = await authenticateWithBiometrics(service, { fallbackToPin: true });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('AUTHENTICATION_FAILED');
      expect(result.error).toBe('Biometric not recognized');
      expect(result.fallbackToPin).toBe(true);
    });

    it('does not fallback when fallbackToPin is false', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (service.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        errorCode: 'USER_CANCEL',
      });

      const result = await authenticateWithBiometrics(service, { fallbackToPin: false });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('USER_CANCEL');
      expect(result.fallbackToPin).toBeFalsy();
    });

    it('does not fallback for permanent lockout', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(true);
      (service.authenticate as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        errorCode: 'LOCKOUT_PERMANENT',
      });

      const result = await authenticateWithBiometrics(service, { fallbackToPin: true });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('LOCKOUT_PERMANENT');
      expect(result.fallbackToPin).toBeFalsy();
    });
  });

  describe('when biometrics are not available', () => {
    it('returns failure with fallback when fallbackToPin is true', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await authenticateWithBiometrics(service, { fallbackToPin: true });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('BIOMETRIC_NOT_AVAILABLE');
      expect(result.fallbackToPin).toBe(true);
      expect(service.authenticate).not.toHaveBeenCalled();
    });

    it('returns failure without fallback when fallbackToPin is false', async () => {
      const service = createMockService();
      (service.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const result = await authenticateWithBiometrics(service, { fallbackToPin: false });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('BIOMETRIC_NOT_AVAILABLE');
      expect(result.fallbackToPin).toBeFalsy();
      expect(service.authenticate).not.toHaveBeenCalled();
    });
  });
});
