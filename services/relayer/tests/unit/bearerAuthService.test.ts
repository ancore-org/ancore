import { BearerAuthService } from '../../src/services/bearerAuthService';

describe('BearerAuthService', () => {
  const secret = 'super-secret-token';
  let authService: BearerAuthService;

  beforeEach(() => {
    authService = new BearerAuthService(secret);
  });

  it('verifies token successfully when it matches the secret', async () => {
    const result = await authService.verifyToken(secret);
    expect(result).toEqual({ callerId: 'relay-client' });
  });

  it('verifies token successfully when it includes Bearer prefix', async () => {
    const result = await authService.verifyToken(`Bearer ${secret}`);
    expect(result).toEqual({ callerId: 'relay-client' });
  });

  it('throws an error when the token is incorrect', async () => {
    await expect(authService.verifyToken('wrong-token')).rejects.toThrow('unauthorized');
  });

  it('throws an error when the token is empty', async () => {
    await expect(authService.verifyToken('')).rejects.toThrow('unauthorized');
  });
});
