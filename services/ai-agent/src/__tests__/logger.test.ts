import { redactForLog } from '../logging/logger';

describe('redactForLog', () => {
  it('redacts prompt field at the top level', () => {
    const input = { prompt: 'secret text', route: '/test' };
    const result = redactForLog(input);
    expect(result.prompt).toBe('[REDACTED]');
    expect(result.route).toBe('/test');
  });

  it('redacts freetext field', () => {
    const input = { freeText: 'secret text', type: 'info' };
    const result = redactForLog(input);
    expect(result.freeText).toBe('[REDACTED]');
    expect(result.type).toBe('info');
  });

  it('redacts nested prompt fields', () => {
    const input = { data: { prompt: 'inner secret' }, status: 'ok' };
    const result = redactForLog(input);
    expect(result.data.prompt).toBe('[REDACTED]');
    expect(result.status).toBe('ok');
  });

  it('handles arrays', () => {
    const input = [{ prompt: 'one' }, { other: 'two' }];
    const result = redactForLog(input);
    expect(result[0].prompt).toBe('[REDACTED]');
    expect(result[1].other).toBe('two');
  });

  it('handles null and undefined', () => {
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog(undefined)).toBeUndefined();
  });
});
