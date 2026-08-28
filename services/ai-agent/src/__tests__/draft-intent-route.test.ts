import request from 'supertest';
import { createApp } from '../server';
import { log } from '../logging/logger';

describe('POST /agent/draft-intent — LLM integration, guardrail, and audit logging', () => {
  const app = createApp();
  let infoSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(log, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('falls back to the deterministic source when ANTHROPIC_API_KEY is unset (no real API call)', async () => {
    expect(process.env['ANTHROPIC_API_KEY']).toBeUndefined();

    const res = await request(app).post('/agent/draft-intent').send({
      prompt: 'Send 10 XLM to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5',
      accountId: 'GABC123',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.source).toBe('deterministic');
  });

  it('always returns a guardrail-satisfying draft response (status=draft, requiresConfirmation=true)', async () => {
    const res = await request(app)
      .post('/agent/draft-intent')
      .send({ prompt: 'Create an invoice for 50 XLM', accountId: 'GABC123' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent).toBeDefined();
    expect(res.body.risk).toBeDefined();
  });

  it('writes an audit log entry with timestamp, accountId, source, intentType, and riskLevel', async () => {
    await request(app).post('/agent/draft-intent').send({
      prompt: 'Send 10 XLM to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5',
      accountId: 'GABC123',
    });

    const auditCall = infoSpy.mock.calls.find(([, message]) => message === 'draft_intent_audit');
    expect(auditCall).toBeDefined();

    const [payload] = auditCall as [Record<string, unknown>, string];
    expect(payload).toMatchObject({
      accountId: 'GABC123',
      source: 'deterministic',
      intentType: 'payment',
      riskLevel: expect.any(String),
    });
    expect(typeof payload['timestamp']).toBe('string');
    expect(Date.parse(payload['timestamp'] as string)).not.toBeNaN();
  });

  it('never lets a secret embedded in the prompt reach the logger verbatim', async () => {
    const fakeSecret = 'S' + 'A'.repeat(55);
    const promptWithSecret = `Send 10 XLM to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5, my secret key is ${fakeSecret}`;

    const res = await request(app)
      .post('/agent/draft-intent')
      .send({ prompt: promptWithSecret, accountId: 'GABC123' });

    expect(res.status).toBe(200);

    // The secret must never appear verbatim anywhere log.info was called with.
    for (const call of infoSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(fakeSecret);
    }

    // The response body itself must not echo the raw secret either.
    expect(JSON.stringify(res.body)).not.toContain(fakeSecret);

    const auditCall = infoSpy.mock.calls.find(([, message]) => message === 'draft_intent_audit');
    expect(auditCall).toBeDefined();
    const [payload] = auditCall as [Record<string, unknown>, string];
    expect(payload['promptRedacted']).toContain('[REDACTED]');
    expect(payload['promptRedacted']).not.toContain(fakeSecret);
  });
});
