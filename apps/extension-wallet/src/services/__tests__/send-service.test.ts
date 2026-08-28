import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProductionSendService } from '../send-service';
import { StellarClient } from '@ancore/stellar';
import { sendMessage } from '../../messaging';

// Mock dependencies
vi.mock('../../messaging', () => ({
  sendMessage: vi.fn(),
}));

vi.mock('../simulation-service', () => ({
  simulateTransaction: vi.fn(),
}));

import { simulateTransaction } from '../simulation-service';

// Fetch is mocked per-test via vi.stubGlobal
const VALID_ACCOUNT = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';
const VALID_DESTINATION = 'GBHHL5543KUJHAWEBZZZIJHQP2EMYY3YPZS2WRJDQ7X6G5HC77625CW7';

describe('createProductionSendService', () => {
  let stellarClient: StellarClient;
  let service: ReturnType<typeof createProductionSendService>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());

    stellarClient = {
      getAccount: vi.fn().mockResolvedValue({ id: VALID_ACCOUNT, sequence: '123' }),
      getNetworkPassphrase: vi.fn().mockReturnValue('Test SDF Network ; September 2015'),
      getNetwork: vi.fn().mockReturnValue('testnet'),
      submitTransaction: vi.fn().mockResolvedValue({ hash: 'mock_hash_123' }),
      getRpcUrls: vi.fn().mockReturnValue(['https://soroban-testnet.stellar.org']),
    } as unknown as StellarClient;

    service = createProductionSendService({
      stellarClient,
      accountAddress: VALID_ACCOUNT,
      environment: 'test',
      isContractAccount: false,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('signTransaction', () => {
    it('builds XDR and calls sendMessage for SIGN_TRANSACTION', async () => {
      vi.mocked(sendMessage).mockResolvedValueOnce({ signedXdr: 'signed_xdr_mock' });

      const txDraft = {
        to: VALID_DESTINATION,
        amount: '10.5',
        total: '10.5000100',
        fee: { baseFee: '100', totalFee: '100', network: 'testnet' as const },
      };

      const result = await service.signTransaction(txDraft);

      expect(stellarClient.getAccount).toHaveBeenCalledWith(VALID_ACCOUNT);
      expect(sendMessage).toHaveBeenCalledWith(
        'SIGN_TRANSACTION',
        expect.objectContaining({
          xdr: expect.any(String),
          networkPassphrase: 'Test SDF Network ; September 2015',
        })
      );
      expect(result).toBe('signed_xdr_mock');
    });
  });

  describe('simulateTransaction', () => {
    it('builds unsigned XDR and maps simulation results', async () => {
      vi.mocked(simulateTransaction).mockResolvedValueOnce({
        fee: '0.0000600',
        resourceLimits: { cpuInsn: 12000, memBytes: 2048 },
        authEntries: [],
        footprint: '',
      });

      const txDraft = {
        to: VALID_DESTINATION,
        amount: '10.5',
        total: '10.5000100',
        fee: { baseFee: '0.0000100', totalFee: '0.0000100', network: 'testnet' as const },
      };

      const result = await service.simulateTransaction!(txDraft);

      expect(simulateTransaction).toHaveBeenCalledWith(
        expect.any(String),
        'testnet',
        expect.objectContaining({ client: stellarClient })
      );
      expect(result.fee).toBe('0.0000600');
      expect(result.outcome).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('returns simulation errors without throwing', async () => {
      vi.mocked(simulateTransaction).mockResolvedValueOnce({
        fee: '0.0000000',
        resourceLimits: { cpuInsn: 0, memBytes: 0 },
        authEntries: [],
        footprint: '',
        error: 'HostError: contract trapped',
      });

      const txDraft = {
        to: VALID_DESTINATION,
        amount: '10.5',
        total: '10.5000100',
        fee: { baseFee: '0.0000100', totalFee: '0.0000100', network: 'testnet' as const },
      };

      const result = await service.simulateTransaction!(txDraft);

      expect(result.error).toBe('HostError: contract trapped');
      expect(result.outcome).toBeUndefined();
    });
  });

  describe('submitTransaction', () => {
    it('submits classic transaction via stellarClient', async () => {
      const result = await service.submitTransaction('signed_xdr_mock');
      expect(stellarClient.submitTransaction).toHaveBeenCalledWith('signed_xdr_mock', {
        retryOptions: { maxRetries: 4, exponential: true },
      });
      expect(result.txId).toBe('mock_hash_123');
    });

    it('submits AA transaction via relayer', async () => {
      service = createProductionSendService({
        stellarClient,
        accountAddress: VALID_ACCOUNT,
        environment: 'local',
        isContractAccount: true,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ hash: 'relayer_hash_456' }),
      } as unknown as Response);

      const result = await service.submitTransaction('signed_xdr_mock');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/execute',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ transaction: 'signed_xdr_mock' }),
        })
      );
      expect(result.txId).toBe('relayer_hash_456');
    });

    it('maps relayer error gracefully', async () => {
      service = createProductionSendService({
        stellarClient,
        accountAddress: VALID_ACCOUNT,
        environment: 'local',
        isContractAccount: true,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: 'Relayer rejected' }),
      } as unknown as Response);

      await expect(service.submitTransaction('signed_xdr_mock')).rejects.toThrow(
        /Something went wrong: An unexpected error occurred|Network Error:/
      );
    });
  });
});
