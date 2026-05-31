import { randomBytes } from 'crypto';
import type { JobQueue } from '../queue/JobQueue';
import type { IdempotencyStore } from '../store/idempotency';
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
} from '../types';
import { mapSimulationError } from './mapSimulationError';
import { mapSubmissionError } from './mapSubmissionError';

const MOCK_GAS_USED = 21_000;
const SIGNED_TX_PARAMETER = 'signedTransactionXdr';
const startTime = Date.now();

/** Generate a synthetic transaction id for dev-only mock submission */
function mockTxId(): string {
  return randomBytes(32).toString('hex').toUpperCase();
}

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
    options?: RelayServiceOptions
  ) {
    this.useMockSubmission = isMockSubmissionEnabled(options);
  }

  async validateRelay(request: RelayExecuteRequest): Promise<ValidationResult> {
    const keyError = this.validateSessionKey(request.sessionKey);
    if (keyError) return { valid: false, error: { code: 'INVALID_SIGNATURE', message: keyError } };

    if (request.nonce < 0) {
      return {
        valid: false,
        error: { code: 'NONCE_REPLAY', message: 'Nonce must be non-negative' },
      };
    }

    const payload = this.canonicalPayload(request);
    const ok = this.signatureService.verify(request.sessionKey, payload, request.signature);
    if (!ok) {
      return {
        valid: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed' },
      };
    }

    return { valid: true };
  }

  async executeRelay(request: RelayExecuteRequest): Promise<RelayExecuteResponse> {
    const validation = await this.validateRelay(request);
    if (!validation.valid) {
      return { success: false, error: validation.error, gasUsed: 0 };
    }

    if (this.useMockSubmission) {
      return { success: true, transactionId: mockTxId(), gasUsed: MOCK_GAS_USED };
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
      const result = await this.transactionSubmitter.submitSignedTransaction(signedXdr);
      return {
        success: true,
        transactionId: result.transactionHash,
        gasUsed: result.gasUsed,
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

    const overallStatus =
      queueStatus.status === 'ok' && rpcStatus.status === 'ok' && storageStatus.status === 'ok'
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
