import request from 'supertest';
import { createApp } from '../server';
import { log } from '../logging/logger';

describe('Request Logger Middleware', () => {
  let app: ReturnType<typeof createApp>;
  let infoSpy: jest.SpyInstance;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    infoSpy = jest.spyOn(log, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('logs request completion and redacts prompt if it ever gets logged', async () => {
    const response = await request(app)
      .post('/agent/draft-intent')
      .send({ prompt: 'Send $5 to Bob', accountId: '123' });

    expect(response.status).toBe(200);

    // Verify log.info was called
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/agent/draft-intent',
        method: 'POST',
        statusCode: 200,
        accountId: '123',
      }),
      'request_complete'
    );

    // Ensure prompt substring does not appear in the arguments
    const logArgs = infoSpy.mock.calls[0];
    const logArgsStr = JSON.stringify(logArgs);
    expect(logArgsStr).not.toContain('Send $5 to Bob');
  });
});
