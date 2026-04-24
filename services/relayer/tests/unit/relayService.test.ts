import { RelayService } from '../../src/services/relayService';
import type { SignatureServiceContract, RelayExecuteRequest } from '../../src/types';

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);

function makeRequest(overrides: Partial<RelayExecuteRequest> = {}): RelayExecuteRequest {
  return {
    sessionKey: VALID_KEY,
    operation: 'relay_execute',
    parameters: {},
    signature: VALID_SIG,
    nonce: 1,
    ...overrides,
  };
}

function makeSignatureService(valid: boolean): SignatureServiceContract {
  return { verify: jest.fn().mockReturnValue(valid) };
}

describe('RelayService', () => {
  describe('validateRelay', () => {
    it('returns valid=true when signature passes', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.validateRelay(makeRequest());
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('returns INVALID_SIGNATURE when signature fails', async () => {
      const svc = new RelayService(makeSignatureService(false));
      const result = await svc.validateRelay(makeRequest());
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_SIGNATURE');
    });

    it('returns INVALID_SIGNATURE for malformed sessionKey', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.validateRelay(makeRequest({ sessionKey: 'bad-key' }));
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_SIGNATURE');
    });

    it('returns NONCE_REPLAY for negative nonce', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.validateRelay(makeRequest({ nonce: -1 }));
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('NONCE_REPLAY');
    });
  });

  describe('executeRelay', () => {
    it('returns success with transactionId and gasUsed on valid request', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.executeRelay(makeRequest());
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^[0-9A-F]{64}$/);
      expect(result.gasUsed).toBe(21_000);
    });

    it('returns success=false and propagates error on invalid request', async () => {
      const svc = new RelayService(makeSignatureService(false));
      const result = await svc.executeRelay(makeRequest());
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SIGNATURE');
      expect(result.gasUsed).toBe(0);
    });
  });

  describe('health', () => {
    it('returns status ok with uptime and timestamp', () => {
      const svc = new RelayService(makeSignatureService(true));
      const h = svc.health();
      expect(h.status).toBe('ok');
      expect(typeof h.uptime).toBe('number');
      expect(h.uptime).toBeGreaterThanOrEqual(0);
      expect(h.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
