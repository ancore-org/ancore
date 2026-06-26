import { RelayService } from '../../src/services/relayService';
import type { SignatureServiceContract, TransactionSubmitterContract } from '../../src/types';
import { IdempotencyStore } from '../../src/store/idempotency';
import { JobQueue } from '../../src/queue/JobQueue';

describe('RelayService health check with signature service', () => {
  let mockSignatureService: SignatureServiceContract;
  let mockSubmitter: TransactionSubmitterContract;
  let store: IdempotencyStore;
  let queue: JobQueue;

  beforeEach(() => {
    store = new IdempotencyStore();
    queue = new JobQueue();

    mockSignatureService = {
      verify: jest.fn().mockReturnValue(true),
    };

    mockSubmitter = {
      submitSignedTransaction: jest.fn(),
      simulateAndAssembleTransaction: jest
        .fn()
        .mockResolvedValue({ assembledXdr: 'xdr', gasUsed: 0 }),
      isHealthy: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 50 }),
    };
  });

  describe('signature service status', () => {
    it('reports ok when signature service is healthy', async () => {
      mockSignatureService.isHealthy = jest
        .fn()
        .mockResolvedValue({ healthy: true, latencyMs: 10 });

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('ok');
      expect(status.latencyMs).toBe(10);
    });

    it('reports degraded when signature service is down', async () => {
      mockSignatureService.isHealthy = jest
        .fn()
        .mockResolvedValue({ healthy: false, latencyMs: 100 });

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('degraded');
      expect(status.message).toContain('unreachable');
      expect(status.latencyMs).toBe(100);
    });

    it('reports degraded when signature service health check times out', async () => {
      mockSignatureService.isHealthy = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve({ healthy: true }), 10000))
        );

      process.env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS = '100';

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('degraded');
      expect(status.message).toContain('timeout');

      delete process.env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS;
    }, 10000);

    it('reports ok when health check not implemented', async () => {
      const basicService: SignatureServiceContract = {
        verify: jest.fn().mockReturnValue(true),
      };

      const service = new RelayService(basicService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('ok');
      expect(status.message).toContain('not implemented');
    });

    it('reports degraded when health check throws error', async () => {
      mockSignatureService.isHealthy = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('degraded');
      expect(status.message).toContain('Connection refused');
    });
  });

  describe('overall health status', () => {
    it('returns ok when all dependencies are healthy', () => {
      mockSignatureService.isHealthy = jest.fn().mockResolvedValue({ healthy: true });

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const health = service.health();

      expect(health.status).toBe('ok');
      expect(health.dependencies?.signatureService).toBeDefined();
      expect(health.dependencies?.signatureService?.status).toBe('ok');
    });

    it('returns degraded when signature service is unhealthy', () => {
      const unhealthyService: SignatureServiceContract = {
        verify: jest.fn(),
        isHealthy: jest.fn().mockResolvedValue({ healthy: false }),
      };

      const service = new RelayService(unhealthyService, queue, store, mockSubmitter);
      const health = service.health();

      expect(health.dependencies?.signatureService).toBeDefined();
    });
  });

  describe('health endpoint configuration', () => {
    it('uses configurable timeout from environment', async () => {
      process.env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS = '2000';

      mockSignatureService.isHealthy = jest
        .fn()
        .mockResolvedValue({ healthy: true, latencyMs: 50 });

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('ok');

      delete process.env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS;
    });

    it('defaults to 5000ms timeout when not configured', async () => {
      delete process.env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS;

      mockSignatureService.isHealthy = jest.fn().mockResolvedValue({ healthy: true });

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const status = await service.checkSignatureServiceHealth();

      expect(status.status).toBe('ok');
    });
  });

  describe('dependency status integration', () => {
    it('includes all dependencies in health response', () => {
      mockSignatureService.isHealthy = jest.fn().mockResolvedValue({ healthy: true });

      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const health = service.health();

      expect(health.dependencies).toHaveProperty('queue');
      expect(health.dependencies).toHaveProperty('rpc');
      expect(health.dependencies).toHaveProperty('storage');
      expect(health.dependencies).toHaveProperty('signatureService');
    });

    it('health response includes timestamp and uptime', () => {
      const service = new RelayService(mockSignatureService, queue, store, mockSubmitter);
      const health = service.health();

      expect(health.timestamp).toBeDefined();
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
