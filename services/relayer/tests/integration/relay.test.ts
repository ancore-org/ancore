import request from 'supertest';
import { NetworkError } from '@ancore/stellar';
import { createApp } from '../../src/server';
import { IdempotencyStore } from '../../src/store/idempotency';
import type {
  AuthServiceContract,
  SignatureServiceContract,
  TransactionSubmitterContract,
  RelayServiceOptions,
} from '../../src/types';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);
const NETWORK_HASH = 'd'.repeat(64);

const validBody = {
  sessionKey: VALID_KEY,
  operation: 'relay_execute',
  parameters: {},
  signature: VALID_SIG,
  nonce: 1,
};

function makeMockSubmitter(
  overrides: Partial<TransactionSubmitterContract> = {}
): TransactionSubmitterContract {
  return {
    simulateAndAssembleTransaction: jest.fn().mockResolvedValue({
      assembledXdr: 'AAAA-assembled-xdr',
      gasUsed: 150,
    }),
    submitSignedTransaction: jest.fn().mockResolvedValue({
      transactionHash: NETWORK_HASH,
      gasUsed: 150,
    }),
    isHealthy: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 5 }),
    ...overrides,
  };
}

function makeApp(
  sigValid = true,
  idempotencyStore?: IdempotencyStore,
  transactionSubmitter?: TransactionSubmitterContract,
  relayOptions?: RelayServiceOptions
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
    idempotencyStore,
    transactionSubmitter,
    relayOptions
  );
}

describe('POST /relay/execute', () => {
  it('200 with transactionId on valid request (mock submission mode)', async () => {
    const res = await request(makeApp(true, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactionId).toMatch(/^[0-9A-F]{64}$/);
    expect(res.body.gasUsed).toBe(0);
  });

  it('422 with NONCE_REPLAY error when submitting the same nonce twice', async () => {
    // We pass makeApp which instantiates a MemoryNonceStore internally inside createApp
    const app = makeApp(true, undefined, undefined, { useMockSubmission: true });

    // First request should succeed
    const res1 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);

    // Second request with same sessionKey and nonce should fail
    const res2 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res2.status).toBe(422);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('NONCE_REPLAY');
  });

  it('200 with network transaction hash when submitter is wired', async () => {
    const submitter = makeMockSubmitter();
    const res = await request(makeApp(true, undefined, submitter))
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send({
        ...validBody,
        parameters: { signedTransactionXdr: 'AAAA-signed-xdr' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactionId).toBe(NETWORK_HASH);
    expect(res.body.gasUsed).toBe(150);
    expect(submitter.simulateAndAssembleTransaction).toHaveBeenCalledWith('AAAA-signed-xdr');
    expect(submitter.submitSignedTransaction).toHaveBeenCalledWith('AAAA-assembled-xdr');
  });

  it('422 with typed error when network submission fails', async () => {
    const submitter = makeMockSubmitter({
      submitSignedTransaction: jest.fn().mockRejectedValue(new NetworkError('Horizon unavailable')),
    });
    const res = await request(makeApp(true, undefined, submitter))
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send({
        ...validBody,
        parameters: { signedTransactionXdr: 'AAAA-signed-xdr' },
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Horizon unavailable');
  });

  it('422 when signature is invalid', async () => {
    const res = await request(makeApp(false, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('400 on schema validation failure (missing fields)', async () => {
    const res = await request(makeApp(true, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send({ sessionKey: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('401 when Authorization header is missing', async () => {
    const res = await request(makeApp(true, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/execute')
      .send(validBody);

    expect(res.status).toBe(401);
  });
});

describe('POST /relay/validate', () => {
  it('200 with valid=true on valid request', async () => {
    const res = await request(makeApp(true, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('422 with valid=false when signature fails', async () => {
    const res = await request(makeApp(false, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.valid).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('400 on schema validation failure', async () => {
    const res = await request(makeApp(true, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('401 when Authorization header is missing', async () => {
    await request(makeApp(true, undefined, undefined, { useMockSubmission: true }))
      .post('/relay/validate')
      .send(validBody)
      .expect(401);
  });
});

describe('GET /relay/status', () => {
  it('200 with status ok and dependency details (no auth required)', async () => {
    const res = await request(makeApp(true, undefined, makeMockSubmitter())).get('/relay/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.queue.status).toBe('ok');
    expect(res.body.dependencies.rpc.status).toBe('ok');
    expect(res.body.dependencies.storage.status).toBe('ok');
  });
});

describe('POST /relay/execute — idempotency-key header', () => {
  it('returns the same response on replay within TTL', async () => {
    const store = new IdempotencyStore();
    const app = makeApp(true, store, undefined, { useMockSubmission: true });

    const first = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .set('idempotency-key', 'test-key-1')
      .send(validBody);

    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const replay = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .set('idempotency-key', 'test-key-1')
      .send(validBody);

    expect(replay.status).toBe(first.status);
    expect(replay.body.transactionId).toBe(first.body.transactionId);
  });

  it('treats distinct keys as independent requests', async () => {
    const store = new IdempotencyStore();
    const app = makeApp(true, store, undefined, { useMockSubmission: true });

    const r1 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .set('idempotency-key', 'key-a')
      .send(validBody);

    const r2 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .set('idempotency-key', 'key-b')
      .send({ ...validBody, nonce: 2 });

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.transactionId).toBeDefined();
    expect(r2.body.transactionId).toBeDefined();
  });

  it('caches error responses too (422 replay)', async () => {
    const store = new IdempotencyStore();
    const app = makeApp(false, store, undefined, { useMockSubmission: true });

    const first = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .set('idempotency-key', 'err-key')
      .send(validBody);

    expect(first.status).toBe(422);

    const replay = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .set('idempotency-key', 'err-key')
      .send(validBody);

    expect(replay.status).toBe(422);
    expect(replay.body.error.code).toBe(first.body.error.code);
  });

  it('falls through without caching when header is absent', async () => {
    const store = new IdempotencyStore();
    const app = makeApp(true, store, undefined, { useMockSubmission: true });

    await request(app).post('/relay/execute').set('Authorization', 'Bearer token').send(validBody);

    expect(store.size()).toBe(0);
  });

  it('rejects duplicate nonces with NONCE_REPLAY error code', async () => {
    const app = makeApp(true, undefined, undefined, { useMockSubmission: true });

    // First request
    const r1 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(r1.status).toBe(200);

    // Replay request with same nonce
    const r2 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(r2.status).toBe(422);
    expect(r2.body.success).toBe(false);
    expect(r2.body.error.code).toBe('NONCE_REPLAY');
  });

  it('does not consume nonce on /relay/validate but rejects it after execution', async () => {
    const app = makeApp(true, undefined, undefined, { useMockSubmission: true });

    // Validate request first (should be valid)
    const v1 = await request(app)
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(v1.status).toBe(200);
    expect(v1.body.valid).toBe(true);

    // Validate request again (should still be valid because validate doesn't consume)
    const v2 = await request(app)
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(v2.status).toBe(200);
    expect(v2.body.valid).toBe(true);

    // Execute the request
    const e1 = await request(app)
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(e1.status).toBe(200);

    // Now validate should fail because nonce is consumed
    const v3 = await request(app)
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);
    expect(v3.status).toBe(422);
    expect(v3.body.valid).toBe(false);
    expect(v3.body.error.code).toBe('NONCE_REPLAY');
  });

  describe('BearerAuthService integration via RELAYER_AUTH_SECRET', () => {
    let originalSecret: string | undefined;

    beforeAll(() => {
      originalSecret = process.env.RELAYER_AUTH_SECRET;
      process.env.RELAYER_AUTH_SECRET = 'integration-secret';
    });

    afterAll(() => {
      if (originalSecret === undefined) {
        delete process.env.RELAYER_AUTH_SECRET;
      } else {
        process.env.RELAYER_AUTH_SECRET = originalSecret;
      }
    });

    it('denies access with 401 when invalid token is supplied', async () => {
      const mockSigService: SignatureServiceContract = {
        verify: jest.fn().mockReturnValue(true),
      };
      const app = createApp(undefined, mockSigService, undefined, undefined, {
        useMockSubmission: true,
      });
      const res = await request(app)
        .post('/relay/execute')
        .set('Authorization', 'Bearer wrong-secret')
        .send(validBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('grants access with 200 when correct token is supplied', async () => {
      const mockSigService: SignatureServiceContract = {
        verify: jest.fn().mockReturnValue(true),
      };
      const app = createApp(undefined, mockSigService, undefined, undefined, {
        useMockSubmission: true,
      });
      const res = await request(app)
        .post('/relay/execute')
        .set('Authorization', 'Bearer integration-secret')
        .send({ ...validBody, nonce: 3 }); // Use a unique nonce to avoid replay rejection

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
