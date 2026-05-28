import request from 'supertest';
import { createApp } from '../../src/server';
import type { AuthServiceContract, SignatureServiceContract } from '../../src/types';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);
const ACCOUNT = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const RECIPIENT = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function futureIso(secondsFromNow = 120): string {
  return new Date(Date.now() + secondsFromNow * 1000).toISOString();
}

function validScheduledTransferBody(startAt = futureIso()) {
  return {
    accountAddress: ACCOUNT,
    to: RECIPIENT,
    amount: '10.5',
    asset: 'XLM',
    frequency: 'once' as const,
    startAt,
    userApproved: true as const,
    relayPayload: {
      sessionKey: VALID_KEY,
      operation: 'relay_execute' as const,
      parameters: { to: RECIPIENT, amount: '10.5' },
      signature: VALID_SIG,
      nonce: 1,
    },
  };
}

function makeApp(sigValid = true) {
  const authService: AuthServiceContract = {
    verifyToken: jest.fn().mockResolvedValue({ callerId: 'test-caller' }),
  };
  const signatureService: SignatureServiceContract = {
    verify: jest.fn().mockReturnValue(sigValid),
  };
  return createApp(authService, signatureService, undefined, { startScheduler: false });
}

describe('Scheduled transfers API', () => {
  it('creates a one-time scheduled transfer with explicit approval', async () => {
    const res = await request(makeApp())
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send(validScheduledTransferBody());

    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe('once');
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.userApprovedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('creates a recurring daily transfer', async () => {
    const res = await request(makeApp())
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send({ ...validScheduledTransferBody(), frequency: 'daily' });

    expect(res.status).toBe(201);
    expect(res.body.data.frequency).toBe('daily');
  });

  it('rejects create without explicit user approval', async () => {
    const body = validScheduledTransferBody();
    const { userApproved: _removed, ...withoutApproval } = body;

    const res = await request(makeApp())
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send(withoutApproval);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('lists scheduled transfers for an account', async () => {
    const app = makeApp();

    await request(app)
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send(validScheduledTransferBody(futureIso(300)));

    const res = await request(app)
      .get('/api/v1/scheduled-transfers')
      .query({ accountAddress: ACCOUNT })
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('pauses and cancels scheduled transfers', async () => {
    const app = makeApp();

    const created = await request(app)
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send(validScheduledTransferBody(futureIso(300)));

    const id = created.body.data.id as string;

    const paused = await request(app)
      .patch(`/api/v1/scheduled-transfers/${id}/pause`)
      .set('Authorization', 'Bearer token');

    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe('paused');

    const cancelled = await request(app)
      .patch(`/api/v1/scheduled-transfers/${id}/cancel`)
      .set('Authorization', 'Bearer token');

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('cancelled');
  });

  it('returns empty execution logs for a newly created transfer', async () => {
    const app = makeApp();

    const created = await request(app)
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send(validScheduledTransferBody(futureIso(300)));

    const id = created.body.data.id as string;

    const res = await request(app)
      .get(`/api/v1/scheduled-transfers/${id}/executions`)
      .set('Authorization', 'Bearer token');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns execution logs after a due transfer runs', async () => {
    const { ScheduledTransferStore } = await import('../../src/scheduler/ScheduledTransferStore');
    const { ScheduledTransferService } = await import(
      '../../src/scheduler/ScheduledTransferService'
    );
    const { RelayService } = await import('../../src/services/relayService');

    const store = new ScheduledTransferStore();
    const relayService = new RelayService({ verify: () => true });
    const service = new ScheduledTransferService(store, relayService);

    const transfer = service.create(validScheduledTransferBody(new Date().toISOString()), 'test-caller');
    await service.processDueTransfers(new Date());

    const executions = service.listExecutions(transfer.id, 'test-caller');
    expect(executions).toHaveLength(1);
    expect(executions[0]?.outcome).toBe('success');
    expect(executions[0]?.transactionId).toMatch(/^[0-9A-F]{64}$/);
  });

  it('rejects cross-caller access to scheduled transfers', async () => {
    const app = makeApp();

    const created = await request(app)
      .post('/api/v1/scheduled-transfers')
      .set('Authorization', 'Bearer token')
      .send(validScheduledTransferBody(futureIso(300)));

    const id = created.body.data.id as string;

    const otherCallerApp = createApp(
      { verifyToken: jest.fn().mockResolvedValue({ callerId: 'other-caller' }) },
      { verify: jest.fn().mockReturnValue(true) },
      undefined,
      { startScheduler: false }
    );

    const pauseAttempt = await request(otherCallerApp)
      .patch(`/api/v1/scheduled-transfers/${id}/pause`)
      .set('Authorization', 'Bearer token');

    expect(pauseAttempt.status).toBe(422);
  });
});
