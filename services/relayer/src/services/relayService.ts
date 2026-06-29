import { randomBytes } from 'crypto';
import { trace } from '@opentelemetry/api';
import { validateTransferPolicy } from '@ancore/types';
import { getSessionKey } from '@ancore/account-abstraction';
import { rpc, Networks } from '@stellar/stellar-sdk';
import * as ed from '@noble/ed25519';
import type { JobQueue } from '../queue/JobQueue';
import type { IdempotencyStore } from '../store/idempotency';
import { NonceStore } from '../store/nonceStore';
import type {
  RelayServiceContract,
  SignatureServiceContract,
  TransactionSubmitterContract,
  RelayServiceOptions,
  RelayExecuteRequest,
  RelayExecuteResponse,
  ValidationResult,
  HealthResponse,
  DependencyStatus,
  RelayError,
} from '../types';
import { mapSimulationError } from './mapSimulationError';
import { mapSubmissionError } from './mapSubmissionError';

const SIGNED_TX_PARAMETER = 'signedTransactionXdr';
const startTime = Date.now();

/** Generate a synthetic transaction id for dev-only mock submission */
function mockTxId(): string {
  return randomBytes(32).toString('hex').toUpperCase();
}

const tracer = trace.getTracer('ancore-relayer');

function isMockSubmissionEnabled(options?: RelayServiceOptions): boolean {
  return options?.useMockSubmission === true || process.env.RELAYER_USE_MOCK_SUBMISSION === 'true';
}

/**
 * RelayService validates signed relay requests and submits pre-signed Soroban
 * transactions to Stellar via Horizon.
 *
 * Security checks performed:
 *  - Signature verification (Ed25519 via SignatureServiceContract)
 *  - Nonce must be a non-negative integer (structural; replay tracking is out of scope for MVP)
 *  - Session key must be a 64-char hex string
 */
export class RelayService implements RelayServiceContract {
  private readonly useMockSubmission: boolean;

  constructor(
    private readonly signatureService: SignatureServiceContract,
    private readonly queue?: JobQueue,
    private readonly store?: IdempotencyStore,
    private readonly transactionSubmitter?: TransactionSubmitterContract,
    options?: RelayServiceOptions,
    private readonly nonceStore?: NonceStore
  ) {
    this.useMockSubmission = isMockSubmissionEnabled(options);
  }

  async validateRelay(request: RelayExecuteRequest): Promise<ValidationResult> {
    return tracer.startActiveSpan('relayer.validate', async (span): Promise<ValidationResult> => {
      span.setAttribute('session_key_id', request.sessionKey);
      span.setAttribute('nonce', request.nonce);

      try {
        const keyError = this.validateSessionKey(request.sessionKey);
        if (keyError) {
          const error: RelayError = { code: 'INVALID_SIGNATURE', message: keyError };
          return { valid: false, error };
        }

        if (request.nonce < 0) {
          const error: RelayError = { code: 'NONCE_REPLAY', message: 'Nonce must be non-negative' };
          return { valid: false, error };
        }

        if (this.nonceStore) {
          try {
            await this.nonceStore.assertFresh(request.sessionKey, request.nonce);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Nonce already used';
            const error: RelayError = { code: 'NONCE_REPLAY', message };
            return { valid: false, error };
          }
        }

        const payload = this.canonicalPayload(request);

        try {
          const targetContract = request.parameters.accountAddress as string;
          const onChainKey = await getSessionKey(
            targetContract,
            request.sessionKey,
            { 
              server: new rpc.Server(process.env.RPC_URL || 'https://soroban-testnet.stellar.org'),
              sourceAccount: targetContract,
              networkPassphrase: process.env.NETWORK_PASSPHRASE || Networks.TESTNET
            }
          );
          if (!onChainKey) {
            return {
              valid: false,
              error: { code: 'INVALID_SIGNATURE', message: 'Session key not found on chain' },
            };
          }
        } catch (e: unknown) {
          // ignore or handle error if contract query fails
        }

        const ok = await ed.verify(
          Buffer.from(request.signature, 'hex'),
          Buffer.from(payload, 'hex'),
          request.sessionKey
        );
        if (!ok) {
          return {
            valid: false,
            error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' },
          };
        }

        if (request.transferPolicy) {
          const { policy, amount, todayTotal } = request.transferPolicy;
          const policyResult = validateTransferPolicy(amount, todayTotal, policy);
          if (policyResult.action === 'block') {
            return {
              valid: false,
              error: { code: 'TRANSFER_LIMIT_EXCEEDED', message: policyResult.message },
            };
          }
        }

        return { valid: true };
      } finally {
        span.end();
      }
    });
  }

  async executeRelay(request: RelayExecuteRequest): Promise<RelayExecuteResponse> {
    const validation = await this.validateRelay(request);
    if (!validation.valid) {
      return { success: false, error: validation.error, gasUsed: 0 };
    }

    if (this.nonceStore) {
      await this.nonceStore.track(request.sessionKey, request.nonce);
    }

    if (this.useMockSubmission) {
      return { success: true, transactionId: mockTxId(), gasUsed: 0 };
    }

    if (!this.transactionSubmitter) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Transaction submitter is not configured',
        },
        gasUsed: 0,
      };
    }

    const signedXdr = this.extractSignedTransactionXdr(request);
    if (!signedXdr) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `Missing required parameter: ${SIGNED_TX_PARAMETER}`,
        },
        gasUsed: 0,
      };
    }

    try {
      const { assembledXdr, gasUsed } = await tracer.startActiveSpan(
        'relayer.simulate',
        async (span) => {
          try {
            return await this.transactionSubmitter!.simulateAndAssembleTransaction(signedXdr);
          } finally {
            span.end();
          }
        }
      );

      const result = await tracer.startActiveSpan('relayer.submit', async (span) => {
        try {
          return await this.transactionSubmitter!.submitSignedTransaction(assembledXdr);
        } finally {
          span.end();
        }
      });

      return {
        success: true,
        transactionId: result.transactionHash,
        gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: mapSimulationError(error) ?? mapSubmissionError(error),
        gasUsed: 0,
      };
    }
  }

  health(): HealthResponse {
    const queueStatus: DependencyStatus = this.queue
      ? { status: 'ok' }
      : { status: 'degraded', message: 'Queue not initialized' };

    const rpcStatus = this.resolveRpcStatus();

    const storageStatus: DependencyStatus = this.store
      ? { status: 'ok' }
      : { status: 'degraded', message: 'Storage not initialized' };

    const signatureServiceStatus = this.resolveSignatureServiceStatus();

    const overallStatus =
      queueStatus.status === 'ok' &&
      rpcStatus.status === 'ok' &&
      storageStatus.status === 'ok' &&
      signatureServiceStatus.status === 'ok'
        ? 'ok'
        : 'degraded';

    return {
      status: overallStatus,
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      dependencies: {
        queue: queueStatus,
        rpc: rpcStatus,
        storage: storageStatus,
        signatureService: signatureServiceStatus,
      },
    };
  }

  /** Async RPC health probe — call from a background tick or status handler when needed */
  async checkRpcHealth(): Promise<DependencyStatus> {
    if (this.useMockSubmission) {
      return { status: 'ok', latencyMs: 12, message: 'Mock submission mode' };
    }

    if (!this.transactionSubmitter) {
      return { status: 'degraded', message: 'Transaction submitter is not configured' };
    }

    try {
      const result = await this.transactionSubmitter.isHealthy();
      if (!result.healthy) {
        return {
          status: 'degraded',
          message: 'Soroban RPC unreachable',
          latencyMs: result.latencyMs,
        };
      }
      return { status: 'ok', latencyMs: result.latencyMs };
    } catch {
      return { status: 'degraded', message: 'Soroban RPC health check failed' };
    }
  }

  /** Async signature service health probe with configurable timeout */
  async checkSignatureServiceHealth(): Promise<DependencyStatus> {
    if (!this.signatureService.isHealthy) {
      return { status: 'ok', message: 'Health check not implemented' };
    }

    const timeoutMs = parseInt(process.env.SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS || '5000', 10);

    try {
      const start = Date.now();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), timeoutMs)
      );

      const result = await Promise.race([this.signatureService.isHealthy(), timeoutPromise]);

      const latencyMs = Date.now() - start;

      if (!result.healthy) {
        return {
          status: 'degraded',
          message: 'Signature service unreachable',
          latencyMs: result.latencyMs ?? latencyMs,
        };
      }

      return { status: 'ok', latencyMs: result.latencyMs ?? latencyMs };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'degraded',
        message: `Signature service health check failed: ${errorMessage}`,
      };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private resolveRpcStatus(): DependencyStatus {
    if (this.useMockSubmission) {
      return { status: 'ok', latencyMs: 12, message: 'Mock submission mode' };
    }

    if (!this.transactionSubmitter) {
      return { status: 'degraded', message: 'Transaction submitter is not configured' };
    }

    return { status: 'ok' };
  }

  private resolveSignatureServiceStatus(): DependencyStatus {
    if (!this.signatureService) {
      return { status: 'degraded', message: 'Signature service is not configured' };
    }

    if (!this.signatureService.isHealthy) {
      return { status: 'ok', message: 'Health check not implemented' };
    }

    return { status: 'ok' };
  }

  private extractSignedTransactionXdr(request: RelayExecuteRequest): string | null {
    const value = request.parameters[SIGNED_TX_PARAMETER];
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    return value.trim();
  }

  private validateSessionKey(key: string): string | null {
    if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      return 'sessionKey must be a 64-char hex-encoded Ed25519 public key';
    }
    return null;
  }

  /** Deterministic canonical payload for signature verification */
  private canonicalPayload(req: RelayExecuteRequest): string {
    return Buffer.from(
      JSON.stringify({ sessionKey: req.sessionKey, operation: req.operation, nonce: req.nonce })
    ).toString('hex');
  }
}
