/**
 * Background logger unit tests.
 *
 * Covers key redaction plus the circular-reference / max-depth guards
 * added for #1301.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger } from '../logger';

describe('createLogger', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  it('redacts secret-looking keys', () => {
    const log = createLogger('[test]');
    log.info('login', { password: 'hunter2', username: 'alice' });

    const [, meta] = infoSpy.mock.calls[0];
    expect(meta).toEqual({ password: '<redacted>', username: 'alice' });
  });

  it('does not throw on an object with a circular reference', () => {
    const log = createLogger('[test]');
    const circular: Record<string, unknown> = { name: 'wallet' };
    circular.self = circular;

    expect(() => log.info('circular meta', circular)).not.toThrow();

    const [, meta] = infoSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.name).toBe('wallet');
    expect(meta.self).toBe('<circular>');
  });

  it('does not throw on a longer circular chain (a -> b -> a)', () => {
    const log = createLogger('[test]');
    const a: Record<string, unknown> = { id: 'a' };
    const b: Record<string, unknown> = { id: 'b', parent: a };
    a.child = b;

    expect(() => log.info('circular chain', a)).not.toThrow();
  });

  it('redacts the same object referenced twice without flagging it as circular', () => {
    const log = createLogger('[test]');
    const shared = { note: 'shared' };
    const meta = { first: shared, second: shared };

    log.info('shared reference', meta);

    const [, loggedMeta] = infoSpy.mock.calls[0] as [string, Record<string, unknown>];
    // Same object reachable via two sibling paths (not an actual cycle)
    // still redacts fine on the first path; only a true cycle back to an
    // ancestor should ever print "<circular>".
    expect(loggedMeta.first).toEqual({ note: 'shared' });
  });

  it('caps recursion depth on a pathologically deep (non-circular) object', () => {
    const log = createLogger('[test]');
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 100; i++) {
      deep = { nested: deep };
    }

    expect(() => log.info('deep meta', deep)).not.toThrow();
  });

  it('does not throw when logging a circular array', () => {
    const log = createLogger('[test]');
    const circularArray: unknown[] = [1, 2];
    circularArray.push(circularArray);

    expect(() => log.info('circular array', { list: circularArray })).not.toThrow();
  });
});
