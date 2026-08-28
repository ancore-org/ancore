/**
 * Contract tests for the relay error-code enum.
 *
 * `error.code` is the stable, machine-readable part of every relay failure
 * response — clients switch on it instead of parsing `error.message`. These
 * tests pin three things at once:
 *
 *   1. The enum, the exported union type, and `openapi.yaml` agree on the
 *      exact set of codes.
 *   2. The HTTP API only ever emits codes from that set.
 *   3. The specific failure scenarios documented in the spec map to the
 *      specific codes clients are told to expect.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { createApp } from '../../src/server';
import { MemoryNonceStore } from '../../src/store/nonceStore';
import { IdempotencyStore } from '../../src/store/idempotency';
import {
  RelayErrorCodes,
  RELAY_ERROR_CODES,
  isRelayErrorCode,
  type RelayErrorCode,
} from '../../src/types';
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

function makeApp(
  sigValid = true,
  opts: { nonceStore?: MemoryNonceStore; idempotencyStore?: IdempotencyStore } = {}
) {
  const authService: AuthServiceContract = {
    verifyToken: jest.fn().mockResolvedValue({ callerId: 'test-caller' }),
  };
  const signatureService: SignatureServiceContract = {
    verify: jest.fn().mockReturnValue(sigValid),
  };
  return createApp(
    authService,
    signatureService,
    opts.idempotencyStore ?? new IdempotencyStore(),
    undefined,
    { useMockSubmission: true, startScheduler: false },
    opts.nonceStore ?? new MemoryNonceStore()
  );
}

function post(app: ReturnType<typeof makeApp>, path: string, body: object) {
  return request(app).post(path).set('Authorization', 'Bearer token').send(body);
}

/** Extract the `RelayError.code` enum values declared in openapi.yaml. */
function specErrorCodes(): string[] {
  const spec = readFileSync(join(__dirname, '../../openapi.yaml'), 'utf8');
  const schema = spec.slice(spec.indexOf('    RelayError:'));
  const enumBlock = schema.slice(schema.indexOf('enum:'), schema.indexOf('description:'));

  return enumBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

describe('Relay error code contract', () => {
  describe('enum definition', () => {
    it('exposes every documented code as a runtime value', () => {
      expect(RELAY_ERROR_CODES).toEqual(
        expect.arrayContaining([
          'INVALID_SIGNATURE',
          'SESSION_KEY_EXPIRED',
          'NONCE_REPLAY',
          'GAS_LIMIT_EXCEEDED',
          'SIMULATION_FAILED',
          'POLICY_DENIED',
          'RPC_DOWN',
          'UNAUTHORIZED',
          'INTERNAL_ERROR',
        ])
      );
    });

    it('keys and values match, so the enum is safe to serialize directly', () => {
      for (const [key, value] of Object.entries(RelayErrorCodes)) {
        expect(value).toBe(key);
      }
    });

    it('contains no duplicate codes', () => {
      expect(new Set(RELAY_ERROR_CODES).size).toBe(RELAY_ERROR_CODES.length);
    });

    it('matches the enum published in openapi.yaml exactly', () => {
      expect([...specErrorCodes()].sort()).toEqual([...RELAY_ERROR_CODES].sort());
    });

    it('narrows unknown values with isRelayErrorCode', () => {
      expect(isRelayErrorCode('POLICY_DENIED')).toBe(true);
      expect(isRelayErrorCode('NOT_A_CODE')).toBe(false);
      expect(isRelayErrorCode(undefined)).toBe(false);
      expect(isRelayErrorCode(42)).toBe(false);
    });
  });

  describe('API responses', () => {
    it('POST /relay/execute returns INVALID_SIGNATURE for a bad signature', async () => {
      const res = await post(makeApp(false), '/relay/execute', validBody);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe(RelayErrorCodes.INVALID_SIGNATURE);
    });

    it('POST /relay/validate returns INVALID_SIGNATURE for a bad signature', async () => {
      const res = await post(makeApp(false), '/relay/validate', validBody);

      expect(res.status).toBe(422);
      expect(res.body.valid).toBe(false);
      expect(res.body.error.code).toBe(RelayErrorCodes.INVALID_SIGNATURE);
    });

    it('POST /relay/execute returns NONCE_REPLAY when a nonce is reused', async () => {
      const app = makeApp(true, { nonceStore: new MemoryNonceStore() });

      const first = await post(app, '/relay/execute', validBody);
      expect(first.status).toBe(200);

      const replay = await post(app, '/relay/execute', validBody);
      expect(replay.status).toBe(422);
      expect(replay.body.error.code).toBe(RelayErrorCodes.NONCE_REPLAY);
    });

    it('POST /relay/execute returns POLICY_DENIED when a transfer policy blocks', async () => {
      const res = await post(makeApp(), '/relay/execute', {
        ...validBody,
        nonce: 2,
        transferPolicy: {
          amount: 5000,
          todayTotal: 0,
          policy: { dailyLimit: 100, stepUpThreshold: 50 },
        },
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe(RelayErrorCodes.POLICY_DENIED);
    });

    it('never emits a code outside the enum', async () => {
      const replayApp = makeApp(true, { nonceStore: new MemoryNonceStore() });
      await post(replayApp, '/relay/execute', validBody);

      const responses = await Promise.all([
        post(makeApp(false), '/relay/execute', validBody),
        post(makeApp(false), '/relay/validate', validBody),
        post(replayApp, '/relay/execute', validBody),
        post(makeApp(), '/relay/execute', {
          ...validBody,
          nonce: 3,
          transferPolicy: {
            amount: 900,
            todayTotal: 200,
            policy: { dailyLimit: 1000, stepUpThreshold: 250 },
          },
        }),
      ]);

      for (const res of responses) {
        const code: unknown = res.body.error?.code;
        expect(isRelayErrorCode(code)).toBe(true);
        expect(RELAY_ERROR_CODES).toContain(code as RelayErrorCode);
      }
    });

    it('pairs every error code with a non-empty human-readable message', async () => {
      const res = await post(makeApp(false), '/relay/execute', validBody);

      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message.length).toBeGreaterThan(0);
      // The message must not be the code itself — clients that log both would
      // otherwise get no extra detail.
      expect(res.body.error.message).not.toBe(res.body.error.code);
    });
  });
});
