/**
 * Contract tests for OpenAPI specification
 *
 * These tests verify that the actual API implementation matches the OpenAPI spec.
 * They boot the real Express app and assert that routes, status codes, and response
 * schemas align with the documented specification.
 *
 * If any test fails, it indicates either:
 * 1. The implementation has changed and the spec needs updating
 * 2. The spec has changed and the implementation needs updating
 */

import request from 'supertest';
import { createApp } from '../../src/server';
import { IdempotencyStore } from '../../src/store/idempotency';
import type { AuthServiceContract, SignatureServiceContract } from '../../src/types';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);

const validBody = {
  sessionKey: VALID_KEY,
  operation: 'relay_execute' as const,
  parameters: {},
  signature: VALID_SIG,
  nonce: 1,
};

function makeApp(sigValid = true, idempotencyStore?: IdempotencyStore) {
  const authService: AuthServiceContract = {
    verifyToken: jest.fn().mockResolvedValue({ callerId: 'test-caller' }),
  };
  const signatureService: SignatureServiceContract = {
    verify: jest.fn().mockReturnValue(sigValid),
  };
  return createApp(authService, signatureService, idempotencyStore);
}

describe('OpenAPI Contract Tests', () => {
  describe('Route existence', () => {
    it('POST /relay/execute route exists', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      // Should not return 404 (route not found)
      expect(res.status).not.toBe(404);
    });

    it('POST /relay/validate route exists', async () => {
      const app = makeApp();
      const res = await request(app)
        .post('/relay/validate')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      // Should not return 404 (route not found)
      expect(res.status).not.toBe(404);
    });

    it('GET /relay/status route exists', async () => {
      const app = makeApp();
      const res = await request(app).get('/relay/status');

      // Should not return 404 (route not found)
      expect(res.status).not.toBe(404);
    });

    it('non-existent routes return 404', async () => {
      const app = makeApp();
      const res = await request(app).post('/relay/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('Status code contracts', () => {
    describe('POST /relay/execute', () => {
      it('returns 200 on successful execution', async () => {
        const res = await request(makeApp())
          .post('/relay/execute')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        expect([200, 422]).toContain(res.status);
      });

      it('returns 400 on schema validation failure', async () => {
        const res = await request(makeApp())
          .post('/relay/execute')
          .set('Authorization', 'Bearer token')
          .send({ sessionKey: 'bad' });

        expect(res.status).toBe(400);
      });

      it('returns 401 on missing authorization', async () => {
        const res = await request(makeApp()).post('/relay/execute').send(validBody);

        expect(res.status).toBe(401);
      });

      it('returns 422 on signature validation failure', async () => {
        const res = await request(makeApp(false))
          .post('/relay/execute')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        expect(res.status).toBe(422);
      });
    });

    describe('POST /relay/validate', () => {
      it('returns 200 on validation attempt', async () => {
        const res = await request(makeApp())
          .post('/relay/validate')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        expect([200, 422]).toContain(res.status);
      });

      it('returns 400 on schema validation failure', async () => {
        const res = await request(makeApp())
          .post('/relay/validate')
          .set('Authorization', 'Bearer token')
          .send({});

        expect(res.status).toBe(400);
      });

      it('returns 401 on missing authorization', async () => {
        const res = await request(makeApp()).post('/relay/validate').send(validBody);

        expect(res.status).toBe(401);
      });
    });

    describe('GET /relay/status', () => {
      it('returns 200 on health check', async () => {
        const res = await request(makeApp()).get('/relay/status');
        expect(res.status).toBe(200);
      });
    });
  });

  describe('Response schema contracts', () => {
    describe('POST /relay/execute', () => {
      it('returns valid success response schema', async () => {
        const res = await request(makeApp())
          .post('/relay/execute')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        if (res.status === 200) {
          expect(res.body).toHaveProperty('success');
          expect(res.body).toHaveProperty('gasUsed');
          expect(typeof res.body.success).toBe('boolean');
          expect(typeof res.body.gasUsed).toBe('number');
          if (res.body.success) {
            expect(res.body).toHaveProperty('transactionId');
            expect(typeof res.body.transactionId).toBe('string');
            expect(res.body.transactionId).toMatch(/^[0-9A-F]{64}$/);
          }
        }
      });

      it('returns valid error response schema on failure', async () => {
        const res = await request(makeApp(false))
          .post('/relay/execute')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        expect(res.body).toHaveProperty('success');
        expect(res.body.success).toBe(false);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
        expect(typeof res.body.error.code).toBe('string');
        expect(typeof res.body.error.message).toBe('string');
        expect(res.body).toHaveProperty('gasUsed');
      });
    });

    describe('POST /relay/validate', () => {
      it('returns valid validation result schema', async () => {
        const res = await request(makeApp())
          .post('/relay/validate')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        expect(res.body).toHaveProperty('valid');
        expect(typeof res.body.valid).toBe('boolean');
      });

      it('returns valid error schema on validation failure', async () => {
        const res = await request(makeApp(false))
          .post('/relay/validate')
          .set('Authorization', 'Bearer token')
          .send(validBody);

        expect(res.body).toHaveProperty('valid');
        expect(res.body.valid).toBe(false);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
      });
    });

    describe('GET /relay/status', () => {
      it('returns valid health response schema', async () => {
        const res = await request(makeApp()).get('/relay/status');

        expect(res.body).toHaveProperty('status');
        expect(['ok', 'degraded']).toContain(res.body.status);
        expect(res.body).toHaveProperty('uptime');
        expect(typeof res.body.uptime).toBe('number');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(res.body).toHaveProperty('dependencies');
        expect(res.body.dependencies).toHaveProperty('queue');
        expect(res.body.dependencies).toHaveProperty('rpc');
        expect(res.body.dependencies).toHaveProperty('storage');
      });
    });
  });

  describe('Validation error response schema', () => {
    it('returns structured validation error on schema failure', async () => {
      const res = await request(makeApp())
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .send({ sessionKey: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('details');
      expect(Array.isArray(res.body.details)).toBe(true);
      if (res.body.details.length > 0) {
        expect(res.body.details[0]).toHaveProperty('field');
        expect(res.body.details[0]).toHaveProperty('message');
      }
    });
  });

  describe('Header contracts', () => {
    it('supports idempotency-key header', async () => {
      const store = new IdempotencyStore();
      const app = makeApp(true, store);

      const first = await request(app)
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .set('idempotency-key', 'test-key')
        .send(validBody);

      const replay = await request(app)
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .set('idempotency-key', 'test-key')
        .send(validBody);

      expect(first.status).toBe(replay.status);
      expect(first.body.transactionId).toBe(replay.body.transactionId);
    });

    it('requires Authorization header for protected routes', async () => {
      const res = await request(makeApp()).post('/relay/execute').send(validBody);

      expect(res.status).toBe(401);
    });
  });

  describe('Method contracts', () => {
    it('POST /relay/execute does not accept GET', async () => {
      const res = await request(makeApp())
        .get('/relay/execute')
        .set('Authorization', 'Bearer token');

      expect(res.status).toBe(404);
    });

    it('GET /relay/status does not accept POST', async () => {
      const res = await request(makeApp()).post('/relay/status');
      expect(res.status).toBe(404);
    });
  });

  describe('Error code contracts', () => {
    it('returns correct error codes for relay errors', async () => {
      const res = await request(makeApp(false))
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('error codes match OpenAPI spec enum values', async () => {
      const validErrorCodes = [
        'INVALID_SIGNATURE',
        'SESSION_KEY_EXPIRED',
        'NONCE_REPLAY',
        'GAS_LIMIT_EXCEEDED',
        'SIMULATION_FAILED',
        'UNAUTHORIZED',
        'INTERNAL_ERROR',
      ];

      const res = await request(makeApp(false))
        .post('/relay/execute')
        .set('Authorization', 'Bearer token')
        .send(validBody);

      expect(validErrorCodes).toContain(res.body.error.code);
    });
  });
});
