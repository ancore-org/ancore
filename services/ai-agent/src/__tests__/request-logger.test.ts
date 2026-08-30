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
    const response = await request(app).post('/agent/draft-intent').send({
      prompt: 'Send $5 to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5',
      accountId: '123',
    });

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

    // Ensure the prompt substring does not appear in the generic
    // request-complete log call (the request logger never reads req.body.prompt).
    // A separate, intentionally-scoped draft_intent_audit log call also fires for
    // this route — see src/__tests__/draft-intent-route.test.ts — and is allowed
    // to carry secret-redacted (not fully blanked) prompt content by design.
    const requestCompleteCall = infoSpy.mock.calls.find(
      ([, message]) => message === 'request_complete'
    );
    expect(requestCompleteCall).toBeDefined();
    expect(JSON.stringify(requestCompleteCall)).not.toContain(
      'Send $5 to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5'
    );
  });

  // Issue #1269 — accountId/intentType were logged straight from req.body
  // with no pass through redactSecrets, so a secret-shaped value in either
  // field reached logs verbatim (redactForLog only strips fields literally
  // named prompt/freeText — a content-pattern match in a differently-named
  // field slipped through it entirely).
  it('redacts a secret-shaped accountId before logging', async () => {
    const stellarSecret = 'S' + 'A'.repeat(55);

    const response = await request(app)
      .post('/agent/draft-intent')
      .send({
        prompt: 'Send $5 to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5',
        accountId: stellarSecret,
      });

    expect(response.status).toBe(200);

    const requestCompleteCall = infoSpy.mock.calls.find(
      ([, message]) => message === 'request_complete'
    );
    expect(requestCompleteCall).toBeDefined();
    expect(JSON.stringify(requestCompleteCall)).not.toContain(stellarSecret);
    expect(JSON.stringify(requestCompleteCall)).toContain('[REDACTED]');
  });

  it('redacts an API-key-shaped intentType before logging', async () => {
    const apiKey = 'sk-ant-api03-' + 'a'.repeat(40);

    const response = await request(app)
      .post('/agent/draft-intent')
      .send({
        prompt: 'Send $5 to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5',
        accountId: '123',
        type: apiKey,
      });

    // The request may fail validation (an API-key string isn't a real
    // intent type) — that's fine, request_complete still fires either way.
    void response;

    const requestCompleteCall = infoSpy.mock.calls.find(
      ([, message]) => message === 'request_complete'
    );
    expect(requestCompleteCall).toBeDefined();
    expect(JSON.stringify(requestCompleteCall)).not.toContain(apiKey);
  });

  it('leaves an ordinary, non-secret-shaped accountId unredacted', async () => {
    const response = await request(app)
      .post('/agent/draft-intent')
      .send({
        prompt: 'Send $5 to GDKRY7GNU3CJQX6FMT2BIPW5ELSZAHOV4DKRY7GNU3CJQX6FMT2BIPW5',
        accountId: 'account_42',
      });

    expect(response.status).toBe(200);

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'account_42' }),
      'request_complete'
    );
  });
});
