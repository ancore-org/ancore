import { buildCanonicalPayload, hashPayload, type CanonicalPayloadInput } from '../builder';
import executeFixture from '../../../fixtures/canonical-payload-execute.json';
import addSessionKeyFixture from '../../../fixtures/canonical-payload-add-session-key.json';
import revokeSessionKeyFixture from '../../../fixtures/canonical-payload-revoke-session-key.json';
import highNonceFixture from '../../../fixtures/canonical-payload-high-nonce.json';
import zeroNonceFixture from '../../../fixtures/canonical-payload-zero-nonce.json';

describe('buildCanonicalPayload', () => {
  describe('golden vectors', () => {
    it('matches canonical fixture for relay_execute', () => {
      const payload = buildCanonicalPayload(executeFixture.input);
      expect(payload).toBe(executeFixture.expectedPayload);
    });

    it('matches canonical fixture for add_session_key', () => {
      const payload = buildCanonicalPayload(addSessionKeyFixture.input);
      expect(payload).toBe(addSessionKeyFixture.expectedPayload);
    });

    it('matches canonical fixture for revoke_session_key', () => {
      const payload = buildCanonicalPayload(revokeSessionKeyFixture.input);
      expect(payload).toBe(revokeSessionKeyFixture.expectedPayload);
    });

    it('matches canonical fixture for high nonce value', () => {
      const payload = buildCanonicalPayload(highNonceFixture.input);
      expect(payload).toBe(highNonceFixture.expectedPayload);
    });

    it('matches canonical fixture for zero nonce', () => {
      const payload = buildCanonicalPayload(zeroNonceFixture.input);
      expect(payload).toBe(zeroNonceFixture.expectedPayload);
    });
  });

  describe('snapshot testing', () => {
    it('produces stable snapshot for relay_execute', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        operation: 'relay_execute',
        nonce: 42,
      };
      expect(buildCanonicalPayload(input)).toMatchSnapshot();
    });

    it('produces stable snapshot for add_session_key', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
        operation: 'add_session_key',
        nonce: 0,
      };
      expect(buildCanonicalPayload(input)).toMatchSnapshot();
    });

    it('produces stable snapshot for revoke_session_key', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        operation: 'revoke_session_key',
        nonce: 999,
      };
      expect(buildCanonicalPayload(input)).toMatchSnapshot();
    });
  });

  describe('property: determinism', () => {
    it('same logical input produces identical canonical bytes', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 100,
      };

      const payload1 = buildCanonicalPayload(input);
      const payload2 = buildCanonicalPayload(input);
      const payload3 = buildCanonicalPayload({ ...input });

      expect(payload1).toBe(payload2);
      expect(payload1).toBe(payload3);
    });

    it('different nonce produces different payload', () => {
      const base: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 1,
      };

      const payload1 = buildCanonicalPayload(base);
      const payload2 = buildCanonicalPayload({ ...base, nonce: 2 });

      expect(payload1).not.toBe(payload2);
    });

    it('different operation produces different payload', () => {
      const base: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 1,
      };

      const payload1 = buildCanonicalPayload(base);
      const payload2 = buildCanonicalPayload({ ...base, operation: 'add_session_key' });

      expect(payload1).not.toBe(payload2);
    });

    it('different sessionKey produces different payload', () => {
      const base: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 1,
      };

      const payload1 = buildCanonicalPayload(base);
      const payload2 = buildCanonicalPayload({
        ...base,
        sessionKey: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
      });

      expect(payload1).not.toBe(payload2);
    });
  });

  describe('property: field ordering', () => {
    it('field order in input object does not affect output', () => {
      const ordered: CanonicalPayloadInput = {
        sessionKey: 'test123test123test123test123test123test123test123test123test123te',
        operation: 'relay_execute',
        nonce: 5,
      };

      const shuffled: Record<string, unknown> = {
        nonce: 5,
        sessionKey: 'test123test123test123test123test123test123test123test123test123te',
        operation: 'relay_execute',
      };

      expect(buildCanonicalPayload(ordered)).toBe(buildCanonicalPayload(shuffled as unknown as CanonicalPayloadInput));
    });
  });

  describe('hash stability', () => {
    it('hash matches fixture for relay_execute', () => {
      const payload = buildCanonicalPayload(executeFixture.input);
      const hash = hashPayload(payload);
      expect(hash).toBe(executeFixture.expectedHash);
    });

    it('hash matches fixture for add_session_key', () => {
      const payload = buildCanonicalPayload(addSessionKeyFixture.input);
      const hash = hashPayload(payload);
      expect(hash).toBe(addSessionKeyFixture.expectedHash);
    });

    it('hash matches fixture for revoke_session_key', () => {
      const payload = buildCanonicalPayload(revokeSessionKeyFixture.input);
      const hash = hashPayload(payload);
      expect(hash).toBe(revokeSessionKeyFixture.expectedHash);
    });

    it('hash matches fixture for high nonce', () => {
      const payload = buildCanonicalPayload(highNonceFixture.input);
      const hash = hashPayload(payload);
      expect(hash).toBe(highNonceFixture.expectedHash);
    });

    it('hash matches fixture for zero nonce', () => {
      const payload = buildCanonicalPayload(zeroNonceFixture.input);
      const hash = hashPayload(payload);
      expect(hash).toBe(zeroNonceFixture.expectedHash);
    });
  });

  describe('encoding', () => {
    it('produces valid hex output', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 42,
      };

      const payload = buildCanonicalPayload(input);
      expect(payload).toMatch(/^[0-9a-f]+$/);
    });

    it('output is even-length hex string', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 42,
      };

      const payload = buildCanonicalPayload(input);
      expect(payload.length % 2).toBe(0);
    });

    it('can decode back to JSON', () => {
      const input: CanonicalPayloadInput = {
        sessionKey: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        operation: 'relay_execute',
        nonce: 42,
      };

      const payload = buildCanonicalPayload(input);
      const decoded = JSON.parse(Buffer.from(payload, 'hex').toString('utf8'));

      expect(decoded).toEqual({
        sessionKey: input.sessionKey,
        operation: input.operation,
        nonce: input.nonce,
      });
    });
  });
});
