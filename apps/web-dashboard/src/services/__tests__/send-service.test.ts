import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SendStrategyDeps } from '../send-service';
import { WalletApiSendStrategy, RelayerSendStrategy, createSendStrategy } from '../send-service';

const VALID_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const TESTNET_DEPS: SendStrategyDeps = { network: 'testnet' };

// ---------------------------------------------------------------------------
// WalletApiSendStrategy
// ---------------------------------------------------------------------------

describe('WalletApiSendStrategy', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates with correct name', () => {
    const strategy = new WalletApiSendStrategy(TESTNET_DEPS);
    expect(strategy.name).toBe('wallet-api');
  });

  it('isAvailable returns false when extension not installed', async () => {
    vi.mock('@ancore/wallet-api', () => {
      throw new Error('Cannot find module');
    });
    const strategy = new WalletApiSendStrategy(TESTNET_DEPS);
    const available = await strategy.isAvailable();
    expect(available).toBe(false);
  });

  it('isAvailable returns false when not connected', async () => {
    vi.mock('@ancore/wallet-api', () => ({
      isConnected: vi.fn(() => Promise.resolve(false)),
    }));
    const strategy = new WalletApiSendStrategy(TESTNET_DEPS);
    const available = await strategy.isAvailable();
    expect(available).toBe(false);
  });

  it('throws fee unavailable when simulated fee is unparseable', async () => {
    vi.mock('@ancore/stellar', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@ancore/stellar')>();
      return {
        ...actual,
        createStellarClient: () => ({
          simulateTransaction: vi.fn().mockResolvedValue({ fee: 'not-a-number' }),
        }),
      };
    });

    const { WalletApiSendStrategy } = await import('../send-service');
    const strategy = new WalletApiSendStrategy(TESTNET_DEPS);
    await expect(strategy.estimateFee({ recipient: VALID_ADDRESS, amount: '10' })).rejects.toThrow(
      'fee unavailable'
    );

    vi.doUnmock('@ancore/stellar');
  });
});

// ---------------------------------------------------------------------------
// RelayerSendStrategy
// ---------------------------------------------------------------------------

describe('RelayerSendStrategy', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates with correct name', () => {
    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    expect(strategy.name).toBe('relayer');
  });

  it('isAvailable returns false when relayer is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Network error')))
    );
    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    const available = await strategy.isAvailable();
    expect(available).toBe(false);
  });

  it('isAvailable returns true when relayer health check passes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true } as Response))
    );
    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    const available = await strategy.isAvailable();
    expect(available).toBe(true);
  });

  it('estimateFee returns base fee values', async () => {
    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    const fee = await strategy.estimateFee({
      recipient: VALID_ADDRESS,
      amount: '10',
    });
    expect(fee.baseFee).toBe('0.0000100');
    expect(fee.minBalance).toBe('0.0050100');
  });

  it('send posts to /relay/execute with a real signed payload (not the old hardcoded fake) and returns job ID', async () => {
    vi.mock('@ancore/wallet-api', () => ({
      signRelayPayload: vi.fn(async () => ({
        sessionKey: 'cd'.repeat(32),
        signature: 'ef'.repeat(64),
      })),
    }));

    const mockFetch = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true, jobId: 'job-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    vi.stubGlobal('fetch', mockFetch);

    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    const result = await strategy.send({ recipient: VALID_ADDRESS, amount: '5.00' });

    expect(result.status).toBe('pending');
    expect(result.hash).toBe('job-123');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/relay/execute'),
      expect.objectContaining({ method: 'POST' })
    );

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(sentBody.sessionKey).toBe('cd'.repeat(32));
    expect(sentBody.signature).toBe('ef'.repeat(64));
    expect(sentBody.sessionKey).not.toBe('a'.repeat(64));
    expect(sentBody.signature).not.toBe('b'.repeat(128));
  });

  it('send throws on relayer error', async () => {
    vi.mock('@ancore/wallet-api', () => ({
      signRelayPayload: vi.fn(async () => ({
        sessionKey: 'cd'.repeat(32),
        signature: 'ef'.repeat(64),
      })),
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ success: false, error: { message: 'Nonce replay' } }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        )
      )
    );

    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    await expect(strategy.send({ recipient: VALID_ADDRESS, amount: '1.00' })).rejects.toThrow(
      'Nonce replay'
    );
  });

  it('send throws on non-ok response', async () => {
    vi.mock('@ancore/wallet-api', () => ({
      signRelayPayload: vi.fn(async () => ({
        sessionKey: 'cd'.repeat(32),
        signature: 'ef'.repeat(64),
      })),
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('Internal error', { status: 500 })))
    );

    const strategy = new RelayerSendStrategy(TESTNET_DEPS);
    await expect(strategy.send({ recipient: VALID_ADDRESS, amount: '1.00' })).rejects.toThrow(
      'Relayer request failed (500)'
    );
  });
});

// ---------------------------------------------------------------------------
// createSendStrategy
// ---------------------------------------------------------------------------

describe('createSendStrategy', () => {
  it('creates WalletApiSendStrategy for wallet-api', () => {
    const strategy = createSendStrategy('wallet-api', TESTNET_DEPS);
    expect(strategy).toBeInstanceOf(WalletApiSendStrategy);
    expect(strategy.name).toBe('wallet-api');
  });

  it('creates RelayerSendStrategy for relayer', () => {
    const strategy = createSendStrategy('relayer', TESTNET_DEPS);
    expect(strategy).toBeInstanceOf(RelayerSendStrategy);
    expect(strategy.name).toBe('relayer');
  });
});
