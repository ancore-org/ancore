import type { AuthServiceContract } from '../types';

/**
 * BearerAuthService implements Bearer token authentication by verifying
 * the token against a configured secret.
 */
export class BearerAuthService implements AuthServiceContract {
  constructor(private readonly secret: string) {}

  async verifyToken(token: string): Promise<{ callerId: string }> {
    // If the token matches the secret directly, or in case the prefix wasn't stripped,
    // matches the full `Bearer <secret>`
    if (token !== this.secret && token !== `Bearer ${this.secret}`) {
      throw new Error('unauthorized');
    }
    return { callerId: 'relay-client' };
  }
}

/**
 * Factory helper for creating BearerAuthService instances.
 */
export function createBearerAuthService(secret: string): AuthServiceContract {
  return new BearerAuthService(secret);
}
