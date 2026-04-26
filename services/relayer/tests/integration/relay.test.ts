import request from 'supertest';
import { createApp } from '../../src/server';
import type { AuthServiceContract, SignatureServiceContract } from '../../src/types';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);

const validBody = {
  sessionKey: VALID_KEY,
  operation: 'relay_execute',
  parameters: {},
  signature: VALID_SIG,
  nonce: 1,
};

function makeApp(sigValid = true) {
  const authService: AuthServiceContract = {
    verifyToken: jest.fn().mockResolvedValue({ callerId: 'test-caller' }),
  };
  const signatureService: SignatureServiceContract = {
    verify: jest.fn().mockReturnValue(sigValid),
  };
  return createApp(authService, signatureService);
}

describe('POST /relay/execute', () => {
  it('200 with transactionId on valid request', async () => {
    const res = await request(makeApp())
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transactionId).toMatch(/^[0-9A-F]{64}$/);
    expect(res.body.gasUsed).toBe(21_000);
  });

  it('422 when signature is invalid', async () => {
    const res = await request(makeApp(false))
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('400 on schema validation failure (missing fields)', async () => {
    const res = await request(makeApp())
      .post('/relay/execute')
      .set('Authorization', 'Bearer token')
      .send({ sessionKey: 'bad' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('401 when Authorization header is missing', async () => {
    const res = await request(makeApp()).post('/relay/execute').send(validBody);

    expect(res.status).toBe(401);
  });
});

describe('POST /relay/validate', () => {
  it('200 with valid=true on valid request', async () => {
    const res = await request(makeApp())
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('422 with valid=false when signature fails', async () => {
    const res = await request(makeApp(false))
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send(validBody);

    expect(res.status).toBe(422);
    expect(res.body.valid).toBe(false);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('400 on schema validation failure', async () => {
    const res = await request(makeApp())
      .post('/relay/validate')
      .set('Authorization', 'Bearer token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });
});

describe('GET /relay/status', () => {
  it('200 with status ok (no auth required)', async () => {
    const res = await request(makeApp()).get('/relay/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
