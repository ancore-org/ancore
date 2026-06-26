import request from 'supertest';
import { createApp } from '../../server';

describe('requestId middleware', () => {
  test('generates X-Request-Id when none supplied', async () => {
    const app = createApp();
    const res = await request(app).get('/relay/status');
    expect(res.status).toBe(200);
    const header = res.header['x-request-id'];
    expect(typeof header).toBe('string');
    expect(header.length).toBeGreaterThan(0);
  });

  test('echoes and accepts valid UUID v4 header', async () => {
    const app = createApp();
    const valid = '01234567-89ab-4cde-8f00-0123456789ab';
    const res = await request(app).get('/relay/status').set('X-Request-Id', valid);
    expect(res.status).toBe(200);
    expect(res.header['x-request-id']).toBe(valid);
  });

  test('rejects invalid X-Request-Id header with 400', async () => {
    const app = createApp();
    const res = await request(app).get('/relay/status').set('X-Request-Id', '!!!INVALID');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});
