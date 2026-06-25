import request from 'supertest';
import { enforceNoAutonomousExecution } from './guardrail';
import { createApp } from './server';
import type { DraftIntentResponse } from './types';

const app = createApp();

describe('GET /health', () => {
  it('returns the service health payload', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'ai-agent',
      version: '0.1.0',
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(Date.parse(res.body.timestamp)).not.toBeNaN();
  });
});

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

describe('POST /v1/intents/validate', () => {
  it('validates a payment intent and returns confirmation false for low-value payments', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '100',
      asset: 'XLM',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.requiresConfirmation).toBe(false);
    expect(res.body.intent).toBeDefined();
  });

  it('validates a payment intent and returns confirmation true for high-value payments', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '1500',
      asset: 'XLM',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent).toBeDefined();
  });

  it('validates a payment intent at exactly the threshold and returns confirmation true', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '1000',
      asset: 'USDC',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent).toBeDefined();
  });

  it('validates a payment intent with decimal amount below threshold', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '999.99',
      asset: 'XLM',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.requiresConfirmation).toBe(false);
    expect(res.body.intent).toBeDefined();
  });

  it('validates a payment intent with decimal amount above threshold', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '1000.01',
      asset: 'USDC',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.requiresConfirmation).toBe(true);
    expect(res.body.intent).toBeDefined();
  });

  it('accepts payment intent with requiresConfirmation field in request', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '100',
      asset: 'XLM',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
      requiresConfirmation: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.intent.requiresConfirmation).toBe(false);
  });

  it('returns validation errors for invalid intent', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: 'invalid',
      asset: 'XLM',
      destination: 'GCZST3XVCDTUJ76ZAV2HA72KYPJW5YJSNXVZTSKNBPWTXGVLNPXQ4JH',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('returns validation errors for missing required fields', async () => {
    const res = await request(app).post('/v1/intents/validate').send({
      type: 'payment',
      amount: '100',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });
});

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
