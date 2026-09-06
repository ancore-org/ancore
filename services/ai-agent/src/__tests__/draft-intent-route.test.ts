import request from 'supertest';
import { createApp } from '../server';
import { log } from '../logging/logger';
import { VALID_ACCOUNT_ID, VALID_ADDRESS } from './fixtures/addresses';

const TEST_API_KEY = 'test-api-key';
process.env['AI_AGENT_API_KEY'] = TEST_API_KEY;

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

    const res = await request(app)
      .post('/agent/draft-intent')
      .set('x-api-key', TEST_API_KEY)
      .send({
        prompt: `Send 10 XLM to ${VALID_ADDRESS}`,
        accountId: VALID_ACCOUNT_ID,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.source).toBe('deterministic');
  });

  it('always returns a guardrail-satisfying draft response (status=draft, requiresConfirmation=true)', async () => {
    const res = await request(app)
      .post('/agent/draft-intent')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: 'Create an invoice for 50 XLM', accountId: VALID_ACCOUNT_ID });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent).toBeDefined();
    expect(res.body.risk).toBeDefined();
  });

  it('writes an audit log entry with timestamp, accountId, source, intentType, and riskLevel', async () => {
    await request(app)
      .post('/agent/draft-intent')
      .set('x-api-key', TEST_API_KEY)
      .send({
        prompt: `Send 10 XLM to ${VALID_ADDRESS}`,
        accountId: VALID_ACCOUNT_ID,
      });

    const auditCall = infoSpy.mock.calls.find(([, message]) => message === 'draft_intent_audit');
    expect(auditCall).toBeDefined();

    const [payload] = auditCall as [Record<string, unknown>, string];
    expect(payload).toMatchObject({
      accountId: VALID_ACCOUNT_ID,
      source: 'deterministic',
      intentType: 'payment',
      riskLevel: expect.any(String),
    });
    expect(typeof payload['timestamp']).toBe('string');
    expect(Date.parse(payload['timestamp'] as string)).not.toBeNaN();
  });

  it('never lets a secret embedded in the prompt reach the logger verbatim', async () => {
    const fakeSecret = 'S' + 'A'.repeat(55);
    const promptWithSecret = `Send 10 XLM to ${VALID_ADDRESS}, my secret key is ${fakeSecret}`;

    const res = await request(app)
      .post('/agent/draft-intent')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: promptWithSecret, accountId: VALID_ACCOUNT_ID });

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
