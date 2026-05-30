import request from 'supertest';
import { createApp } from './server';
import { enforceNoAutonomousExecution } from './guardrail';
import type { DraftIntentResponse } from './types';

const app = createApp();

// ── /health ───────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'ai-agent' });
  });
});

// ── /agent/draft-intent ───────────────────────────────────────────────────────

describe('POST /agent/draft-intent', () => {
  const validBody = { prompt: 'Send 10 XLM to Alice', accountId: 'GABC123' };

  it('returns 200 with a draft payment intent', async () => {
    const res = await request(app).post('/agent/draft-intent').send(validBody);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent.type).toBe('payment');
    expect(res.body.summary).toBeDefined();
  });

  it('returns 200 with a draft invoice intent when prompt contains "invoice"', async () => {
    const res = await request(app)
      .post('/agent/draft-intent')
      .send({ prompt: 'Create an invoice for 50 XLM', accountId: 'GABC123' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent.type).toBe('invoice');
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app).post('/agent/draft-intent').send({ accountId: 'GABC123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 when accountId is missing', async () => {
    const res = await request(app).post('/agent/draft-intent').send({ prompt: 'Send 10 XLM' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/agent/draft-intent').send({});
    expect(res.status).toBe(400);
  });
});

// ── guardrail ─────────────────────────────────────────────────────────────────

describe('enforceNoAutonomousExecution', () => {
  const validDraft: DraftIntentResponse = {
    status: 'draft',
    requiresConfirmation: true,
    summary: 'test',
    intent: { type: 'payment', destination: 'G123', amount: '10', asset: 'XLM' },
  };

  it('does not throw for a valid draft response', () => {
    expect(() => enforceNoAutonomousExecution(validDraft)).not.toThrow();
  });

  it('throws when status is not "draft"', () => {
    const bad = { ...validDraft, status: 'executed' } as unknown as DraftIntentResponse;
    expect(() => enforceNoAutonomousExecution(bad)).toThrow('GUARDRAIL VIOLATION');
  });

  it('throws when requiresConfirmation is false', () => {
    const bad = { ...validDraft, requiresConfirmation: false } as unknown as DraftIntentResponse;
    expect(() => enforceNoAutonomousExecution(bad)).toThrow('GUARDRAIL VIOLATION');
  });
});
