import { createApp } from './server';
import { resetEnvCache } from './config/env';

describe('relayer server startup guard', () => {
  afterEach(() => {
    resetEnvCache();
  });

  it('refuses to boot in production without a real auth secret', () => {
    const originalEnv = process.env;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalRelayerAuthSecret = process.env.RELAYER_AUTH_SECRET;
    const originalExit = process.exit;

    const exitSpy = jest.fn((code?: string | number | null) => {
      throw new Error(`process.exit:${code ?? 'undefined'}`);
    }) as unknown as typeof process.exit;

    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      RELAYER_AUTH_SECRET: '',
    } as NodeJS.ProcessEnv;
    process.exit = exitSpy;
    resetEnvCache();

    try {
      expect(() => createApp()).toThrow('process.exit:1');
    } finally {
      process.env = originalEnv;
      process.env.NODE_ENV = originalNodeEnv;
      process.env.RELAYER_AUTH_SECRET = originalRelayerAuthSecret;
      process.exit = originalExit;
    }
  });
});
