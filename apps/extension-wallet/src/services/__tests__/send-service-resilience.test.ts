import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createProductionSendService,
  RELAYER_SUBMIT_MAX_RETRIES,
  RELAYER_SUBMIT_TIMEOUT_MS,
  TX_STATUS_TIMEOUT_MS,
} from '../send-service';
import { StellarClient } from '@ancore/stellar';

vi.mock('../../messaging', () => ({ sendMessage: vi.fn() }));
vi.mock('../simulation-service', () => ({ simulateTransaction: vi.fn() }));

/**
 * Timeout and retry on the smart-account send path (#1350), and the
 * distinction between "not indexed yet" and "we could not check" (#1351).
 *
 * Both gaps lived in the same function and produced the same user-visible
 * outcome: a send that appears to be in flight forever, with no way to tell
 * whether anything is actually happening.
 */

const VALID_ACCOUNT = 'GBBM6BKZPEHWYO3E3YKREDPQXMS4VK35YLNU7NFBRI26RAN7GI5POFBB';

function makeStellarClient(): StellarClient {
  return {
    getAccount: vi.fn().mockResolvedValue({ id: VALID_ACCOUNT, sequence: '123' }),
    getNetworkPassphrase: vi.fn().mockReturnValue('Test SDF Network ; September 2015'),
    getNetwork: vi.fn().mockReturnValue('testnet'),
    submitTransaction: vi.fn().mockResolvedValue({ hash: 'classic_hash' }),
    getRpcUrls: vi.fn().mockReturnValue(['https://horizon-testnet.stellar.org/soroban/rpc']),
  } as unknown as StellarClient;
}

/** An `AbortError`, as `fetch` raises when its signal fires. */
function abortError(): Error {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

/** A network-level `fetch` failure — what a refused or dropped connection throws. */
function networkError(): Error {
  const error = new TypeError('Failed to fetch');
  return error;
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

describe('relayer submission resilience (#1350)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof createProductionSendService>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    service = createProductionSendService({
      stellarClient: makeStellarClient(),
      accountAddress: VALID_ACCOUNT,
      environment: 'test',
      isContractAccount: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  /**
   * Drive the submission to completion, letting the backoff timers elapse.
   *
   * The outcome is captured immediately rather than awaited later: the
   * promise can settle while `runAllTimersAsync` is draining, and a rejection
   * with no handler attached yet surfaces as an unhandled rejection that
   * Vitest reports as a run-level error.
   */
  async function submit(payload = 'signed-xdr') {
    const settled = service.submitTransaction(payload).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    );
    // Backoff sleeps are real timers; advance them rather than waiting.
    await vi.runAllTimersAsync();

    const outcome = await settled;
    if (!outcome.ok) {
      throw outcome.error;
    }
    return outcome.value;
  }

  it('passes an abort signal so a hung relayer cannot stall the send', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hash: 'relayed' }));

    await submit();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('has a timeout short enough to be worth retrying', () => {
    expect(RELAYER_SUBMIT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RELAYER_SUBMIT_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('retries a timed-out attempt and succeeds', async () => {
    fetchMock
      .mockRejectedValueOnce(abortError())
      .mockResolvedValueOnce(jsonResponse({ hash: 'relayed' }));

    await expect(submit()).resolves.toEqual({ txId: 'relayed' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a dropped connection', async () => {
    fetchMock
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce(jsonResponse({ txId: 'relayed-alt' }));

    await expect(submit()).resolves.toEqual({ txId: 'relayed-alt' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry budget instead of hanging forever', async () => {
    fetchMock.mockRejectedValue(abortError());

    await expect(submit()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(RELAYER_SUBMIT_MAX_RETRIES + 1);
  });

  /**
   * An HTTP error means the relayer answered. Repeating a request it has
   * already judged just repeats the judgement — and for a payment, every
   * needless resend is another chance to be misread as a second intent.
   */
  it('does not retry a relayer that answered with an error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: 'insufficient balance' }, { ok: false, status: 400 })
    );

    await expect(submit()).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * A retry must be recognisable as the same payment. The key is derived from
   * the signed payload, so every attempt carries the same one — a random key
   * per attempt would make retries indistinguishable from new sends.
   */
  it('sends a stable idempotency key across retries', async () => {
    fetchMock
      .mockRejectedValueOnce(abortError())
      .mockRejectedValueOnce(abortError())
      .mockResolvedValueOnce(jsonResponse({ hash: 'relayed' }));

    await submit('the-same-signed-payload');

    const keys = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBeTruthy();
  });

  it('derives a different key for a different payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ hash: 'relayed' }));

    await submit('payload-one');
    await submit('payload-two');

    const [first, second] = fetchMock.mock.calls.map(([, init]) => init.headers['Idempotency-Key']);
    expect(first).not.toBe(second);
  });

  it('backs off between attempts rather than hammering the relayer', async () => {
    fetchMock.mockRejectedValue(abortError());
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await expect(submit()).rejects.toThrow();

    // Delays passed to the backoff sleeps, in call order. Excludes the
    // per-attempt abort timers, which all use the same fixed duration.
    const backoffDelays = setTimeoutSpy.mock.calls
      .map(([, delay]) => delay as number)
      .filter((delay) => delay !== RELAYER_SUBMIT_TIMEOUT_MS);

    expect(backoffDelays.length).toBeGreaterThanOrEqual(2);
    for (let index = 1; index < backoffDelays.length; index += 1) {
      expect(backoffDelays[index]).toBeGreaterThan(backoffDelays[index - 1]);
    }
  });

  it('still rejects a response with no transaction id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(submit()).rejects.toThrow();
  });

  /** The classic path keeps its own retry policy; this must not touch it. */
  it('leaves the classic-account path on the SDK retry policy', async () => {
    const stellarClient = makeStellarClient();
    const classic = createProductionSendService({
      stellarClient,
      accountAddress: VALID_ACCOUNT,
      environment: 'test',
      isContractAccount: false,
    });

    await expect(classic.submitTransaction('signed')).resolves.toEqual({
      txId: 'classic_hash',
    });
    expect(stellarClient.submitTransaction).toHaveBeenCalledWith('signed', {
      retryOptions: { maxRetries: 4, exponential: true },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('transaction status checks (#1351)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof createProductionSendService>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    service = createProductionSendService({
      stellarClient: makeStellarClient(),
      accountAddress: VALID_ACCOUNT,
      environment: 'test',
      isContractAccount: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports a confirmed transaction', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: true, status: 200 }));

    await expect(service.fetchTransactionStatus('tx')).resolves.toBe('confirmed');
  });

  /** 404 is a real answer: the network has not indexed it yet. */
  it('reports a genuinely pending transaction as pending', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 404 }));

    await expect(service.fetchTransactionStatus('tx')).resolves.toBe('pending');
  });

  /**
   * The bug this fixes: a dead endpoint used to be reported as `'pending'`,
   * so the UI polled forever showing a transaction "confirming" that nobody
   * had been able to look up.
   */
  it('reports a network failure as unreachable, not pending', async () => {
    fetchMock.mockRejectedValue(networkError());

    await expect(service.fetchTransactionStatus('tx')).resolves.toBe('unreachable');
  });

  it('reports a timed-out check as unreachable', async () => {
    fetchMock.mockRejectedValue(abortError());

    await expect(service.fetchTransactionStatus('tx')).resolves.toBe('unreachable');
  });

  /**
   * A 5xx is the endpoint talking about itself, not about the transaction —
   * the same epistemic position as no answer at all.
   */
  it('treats a server error as unreachable rather than a failed transaction', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }));

    await expect(service.fetchTransactionStatus('tx')).resolves.toBe('unreachable');
  });

  it('still reports a real rejection as failed', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 400 }));

    await expect(service.fetchTransactionStatus('tx')).resolves.toBe('failed');
  });

  it('bounds the status check with an abort signal', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: true, status: 200 }));

    await service.fetchTransactionStatus('tx');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(TX_STATUS_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
