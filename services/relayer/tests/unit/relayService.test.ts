jest.mock('@ancore/account-abstraction', () => ({
  getSessionKey: jest.fn(),
}));

import { getSessionKey } from '@ancore/account-abstraction';
import { NetworkError } from '@ancore/stellar';
import { RelayService } from '../../src/services/relayService';
import { JobQueue } from '../../src/queue/JobQueue';
import { IdempotencyStore } from '../../src/store/idempotency';
import { NonceStore, MemoryNonceStore } from '../../src/store/nonceStore';
import type {
  SignatureServiceContract,
  RelayExecuteRequest,
  TransactionSubmitterContract,
} from '../../src/types';

const mockedGetSessionKey = jest.mocked(getSessionKey);

const VALID_KEY = 'a'.repeat(64);
const VALID_SIG = 'b'.repeat(128);
const NETWORK_HASH = 'c'.repeat(64);
const ACCOUNT_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const MOCK_SESSION_KEY = {
  publicKey: VALID_KEY,
  permissions: [1],
  expiresAt: Date.now() + 60_000,
};

function makeRequest(overrides: Partial<RelayExecuteRequest> = {}): RelayExecuteRequest {
  return {
    sessionKey: VALID_KEY,
    operation: 'relay_execute',
    parameters: { accountAddress: ACCOUNT_ADDRESS },
    signature: VALID_SIG,
    nonce: 1,
    ...overrides,
  };
}

function makeSignatureService(valid: boolean): SignatureServiceContract {
  return { verify: jest.fn().mockReturnValue(valid) };
}

function makeSubmitter(
  overrides: Partial<TransactionSubmitterContract> = {}
): TransactionSubmitterContract {
  return {
    simulateAndAssembleTransaction: jest.fn().mockResolvedValue({
      assembledXdr: 'AAAA-assembled-xdr',
      gasUsed: 150,
    }),
    submitSignedTransaction: jest.fn().mockResolvedValue({
      transactionHash: NETWORK_HASH,
      gasUsed: 150,
    }),
    isHealthy: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 8 }),
    ...overrides,
  };
}

describe('RelayService', () => {
  beforeEach(() => {
    mockedGetSessionKey.mockResolvedValue(MOCK_SESSION_KEY);
  });

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

    it('returns NONCE_REPLAY if nonce is already seen in nonceStore', async () => {
      const nonceStore = new MemoryNonceStore();
      nonceStore.track(VALID_KEY, 1);
      const svc = new RelayService(
        makeSignatureService(true),
        undefined,
        undefined,
        undefined,
        { useMockSubmission: true },
        nonceStore
      );
      const result = await svc.validateRelay(makeRequest({ nonce: 1 }));
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('NONCE_REPLAY');
      expect(result.error?.message).toBe('Nonce already used');
    });

    it('logs a redacted NONCE_REPLAY_DETECTED warning when a nonce is replayed', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const nonceStore = new MemoryNonceStore();
      nonceStore.track(VALID_KEY, 1);
      const svc = new RelayService(
        makeSignatureService(true),
        undefined,
        undefined,
        undefined,
        { useMockSubmission: true },
        nonceStore
      );

      const result = await svc.validateRelay(makeRequest({ nonce: 1 }), {
        clientIp: '203.0.113.10',
      });

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('NONCE_REPLAY');

      const audit = warn.mock.calls
        .map(
          (call) =>
            call[0] as {
              event?: string;
              sessionKey?: string;
              nonce?: number;
              clientIp?: string;
            }
        )
        .find((entry) => entry?.event === 'NONCE_REPLAY_DETECTED');

      expect(audit).toEqual(
        expect.objectContaining({
          event: 'NONCE_REPLAY_DETECTED',
          sessionKey: 'aaaa\u2026aaaa',
          nonce: 1,
          clientIp: '203.0.113.10',
        })
      );
      expect(audit?.sessionKey).not.toBe(VALID_KEY);
      expect(JSON.stringify(audit)).not.toContain(VALID_KEY);

      warn.mockRestore();
    });

    it('rejects a step-up amount until the caller confirms it', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.validateRelay(
        makeRequest({
          transferPolicy: {
            amount: 500,
            todayTotal: 0,
            policy: { dailyLimit: 1000, stepUpThreshold: 250 },
          },
        })
      );
      expect(result.valid).toBe(false);
      expect(result.requiresStepUp).toBe(true);
      expect(result.error?.code).toBe('POLICY_DENIED');
      expect(result.error?.message).toContain('additional confirmation');
    });

    it('accepts a step-up amount after explicit confirmation', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.validateRelay(
        makeRequest({
          transferPolicy: {
            amount: 500,
            todayTotal: 0,
            policy: { dailyLimit: 1000, stepUpThreshold: 250 },
            stepUpConfirmed: true,
          },
        })
      );
      expect(result.valid).toBe(true);
      expect(result.requiresStepUp).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('still blocks amounts over the daily limit', async () => {
      const svc = new RelayService(makeSignatureService(true));
      const result = await svc.validateRelay(
        makeRequest({
          transferPolicy: {
            amount: 500,
            todayTotal: 600,
            policy: { dailyLimit: 1000, stepUpThreshold: 250 },
            stepUpConfirmed: true,
          },
        })
      );
      expect(result.valid).toBe(false);
      expect(result.requiresStepUp).toBeUndefined();
      expect(result.error?.code).toBe('POLICY_DENIED');
    });
  });

  describe('executeRelay', () => {
    it('returns mock transactionId when mock submission is enabled', async () => {
      const svc = new RelayService(makeSignatureService(true), undefined, undefined, undefined, {
        useMockSubmission: true,
      });
      const result = await svc.executeRelay(makeRequest());
      expect(result.success).toBe(true);
      expect(result.transactionId).toMatch(/^[0-9A-F]{64}$/);
      expect(result.gasUsed).toBe(0);
    });

    it('tracks nonce in nonceStore upon successful execution', async () => {
      const nonceStore = new MemoryNonceStore();
      const svc = new RelayService(
        makeSignatureService(true),
        undefined,
        undefined,
        undefined,
        { useMockSubmission: true },
        nonceStore
      );
      const req = makeRequest({ nonce: 42 });
      const r1 = await svc.executeRelay(req);
      expect(r1.success).toBe(true);

      // Now it should be in the store
      expect(() => nonceStore.assertFresh(VALID_KEY, 42)).toThrow('Nonce already used');

      // Subsequent execution with same request (nonce 42) should fail
      const r2 = await svc.executeRelay(req);
      expect(r2.success).toBe(false);
      expect(r2.error?.code).toBe('NONCE_REPLAY');
    });

    it('does not execute a step-up transfer until it is confirmed', async () => {
      const svc = new RelayService(makeSignatureService(true), undefined, undefined, undefined, {
        useMockSubmission: true,
      });
      const unconfirmed = await svc.executeRelay(
        makeRequest({
          transferPolicy: {
            amount: 500,
            todayTotal: 0,
            policy: { dailyLimit: 1000, stepUpThreshold: 250 },
          },
        })
      );
      expect(unconfirmed.success).toBe(false);
      expect(unconfirmed.error?.code).toBe('POLICY_DENIED');

      const confirmed = await svc.executeRelay(
        makeRequest({
          nonce: 2,
          transferPolicy: {
            amount: 500,
            todayTotal: 0,
            policy: { dailyLimit: 1000, stepUpThreshold: 250 },
            stepUpConfirmed: true,
          },
        })
      );
      expect(confirmed.success).toBe(true);
    });

    it('tracks a fresh nonce while verifying the originally signed nonce', async () => {
      const nonceStore = new MemoryNonceStore();
      const verify = jest.fn().mockReturnValue(true);
      const svc = new RelayService(
        { verify },
        undefined,
        undefined,
        undefined,
        { useMockSubmission: true },
        nonceStore
      );

      const result = await svc.executeRelay(makeRequest({ nonce: 8 }), { signedNonce: 1 });

      expect(result.success).toBe(true);
      const payload = verify.mock.calls[0]?.[1] as string;
      const parsed = JSON.parse(Buffer.from(payload, 'hex').toString('utf8')) as { nonce: number };
      expect(parsed.nonce).toBe(1);
      expect(() => nonceStore.assertFresh(VALID_KEY, 8)).toThrow('Nonce already used');
      expect(() => nonceStore.assertFresh(VALID_KEY, 1)).not.toThrow();
    });

    it('returns network transaction hash from submitter on valid request', async () => {
      const submitter = makeSubmitter();
      const svc = new RelayService(makeSignatureService(true), undefined, undefined, submitter);
      const result = await svc.executeRelay(
        makeRequest({ parameters: { signedTransactionXdr: 'AAAA-signed-xdr' } })
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe(NETWORK_HASH);
      expect(result.gasUsed).toBe(150);
      expect(submitter.simulateAndAssembleTransaction).toHaveBeenCalledWith('AAAA-signed-xdr');
      expect(submitter.submitSignedTransaction).toHaveBeenCalledWith('AAAA-assembled-xdr');
    });

    it('returns INTERNAL_ERROR when signedTransactionXdr is missing', async () => {
      const svc = new RelayService(
        makeSignatureService(true),
        undefined,
        undefined,
        makeSubmitter()
      );
      const result = await svc.executeRelay(makeRequest());
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INTERNAL_ERROR');
      expect(result.gasUsed).toBe(0);
    });

    it('maps submitter network errors to typed relay errors', async () => {
      const submitter = makeSubmitter({
        submitSignedTransaction: jest.fn().mockRejectedValue(new NetworkError('Horizon down')),
      });
      const svc = new RelayService(makeSignatureService(true), undefined, undefined, submitter);
      const result = await svc.executeRelay(
        makeRequest({ parameters: { signedTransactionXdr: 'AAAA-signed-xdr' } })
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RPC_DOWN');
      expect(result.error?.message).toBe('Horizon down');
    });

    it('returns SIMULATION_FAILED when simulation rejects the transaction', async () => {
      const { SimulationFailedError } = await import('@ancore/stellar');
      const submitter = makeSubmitter({
        simulateAndAssembleTransaction: jest
          .fn()
          .mockRejectedValue(new SimulationFailedError('contract revert')),
      });
      const svc = new RelayService(makeSignatureService(true), undefined, undefined, submitter);
      const result = await svc.executeRelay(
        makeRequest({ parameters: { signedTransactionXdr: 'AAAA-signed-xdr' } })
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SIMULATION_FAILED');
      expect(result.error?.message).toBe('contract revert');
      expect(submitter.submitSignedTransaction).not.toHaveBeenCalled();
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
      const svc = new RelayService(
        makeSignatureService(true),
        new JobQueue(),
        new IdempotencyStore()
      );
      const h = svc.health();
      expect(h.status).toBe('degraded');
      expect(typeof h.uptime).toBe('number');
      expect(h.uptime).toBeGreaterThanOrEqual(0);
      expect(h.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(h.dependencies?.rpc.status).toBe('degraded');
    });

    it('reports ok rpc status when submitter is configured', () => {
      const svc = new RelayService(
        makeSignatureService(true),
        new JobQueue(),
        new IdempotencyStore(),
        makeSubmitter()
      );
      const h = svc.health();
      expect(h.dependencies?.rpc.status).toBe('ok');
    });
  });

  describe('checkRpcHealth', () => {
    it('returns healthy status from submitter probe', async () => {
      const svc = new RelayService(
        makeSignatureService(true),
        undefined,
        undefined,
        makeSubmitter()
      );
      await expect(svc.checkRpcHealth()).resolves.toEqual({
        status: 'ok',
        latencyMs: 8,
      });
    });
  });
});
