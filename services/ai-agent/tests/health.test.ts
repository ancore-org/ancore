import request from 'supertest';
import { createApp } from '../src/server';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes uptime as a non-negative number', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('includes a valid ISO timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('identifies the service as ai-agent', async () => {
    const res = await request(app).get('/health');
    expect(res.body.service).toBe('ai-agent');
  });

  it('includes a version field', async () => {
    const res = await request(app).get('/health');
    expect(typeof res.body.version).toBe('string');
  });
});
