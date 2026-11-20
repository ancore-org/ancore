import { randomBytes } from 'crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { validateTransferPolicyConstraints } from '../validation/transferPolicy';
import { getSessionKey } from '@ancore/account-abstraction';
import { rpc } from '@stellar/stellar-sdk';
import { getEnv } from '../config/env';
import { buildCanonicalPayload } from '../payload/builder';
import type { JobQueueContract } from '../queue/types';
import type { IdempotencyStoreContract } from '../store/idempotency';
import type { NonceStore } from '../store/nonceStore';
import type {
  RelayServiceContract,
  SignatureServiceContract,
  TransactionSubmitterContract,
  RelayServiceOptions,
  RelayExecuteRequest,
  RelayExecuteResponse,
  RelayExecutionOptions,
  ValidationResult,
  HealthResponse,
  DependencyStatus,
  RelayError,
} from '../types';
import { RelayErrorCodes } from '../types';
import { mapSimulationError } from './mapSimulationError';
import { mapSubmissionError } from './mapSubmissionError';
import { recordSubmitLatency, relaySubmissionDuration } from '../metrics';
import { rootLogger } from '../logging';

const SIGNED_TX_PARAMETER = 'signedTransactionXdr';
const startTime = Date.now();

function mockTxId(): string {
  return randomBytes(32).toString('hex').toUpperCase();
}

const tracer = trace.getTracer('ancore-relayer');

/** Keep the first and last 4 characters of a session key; hide the middle. */
function redactAuditSessionKey(sessionKey: string): string {
  if (sessionKey.length <= 8) {
    return '[REDACTED]';
  }
  return `${sessionKey.slice(0, 4)}\u2026${sessionKey.slice(-4)}`;
}

function logNonceReplay(request: RelayExecuteRequest, clientIp?: string): void {
  rootLogger.warn(
    {
      event: 'NONCE_REPLAY_DETECTED',
      sessionKey: redactAuditSessionKey(request.sessionKey),
      nonce: request.nonce,
      clientIp,
    },
    'NONCE_REPLAY_DETECTED'
  );
}

function isMockSubmissionEnabled(options?: RelayServiceOptions): boolean {
  return options?.useMockSubmission === true || getEnv().RELAYER_USE_MOCK_SUBMISSION;
}

export class RelayService implements RelayServiceContract {
  private readonly useMockSubmission: boolean;

  constructor(
    private readonly signatureService: SignatureServiceContract,
    private readonly queue?: JobQueueContract,
    private readonly store?: IdempotencyStoreContract,
    private readonly transactionSubmitter?: TransactionSubmitterContract,
    options?: RelayServiceOptions,
    private readonly nonceStore?: NonceStore
  ) {
    this.useMockSubmission = isMockSubmissionEnabled(options);
  }

  async validateRelay(
    request: RelayExecuteRequest,
    options?: RelayExecutionOptions
  ): Promise<ValidationResult> {
    return tracer.startActiveSpan('relayer.validate', async (span): Promise<ValidationResult> => {
      span.setAttribute('session_key_id', request.sessionKey);
      span.setAttribute('nonce', request.nonce);
      span.setAttribute('operation', request.operation);

      try {
        const keyError = this.validateSessionKey(request.sessionKey);
        if (keyError) {
          const error: RelayError = {
            code: RelayErrorCodes.INVALID_SIGNATURE,
            message: keyError,
          };
          span.setStatus({ code: SpanStatusCode.ERROR, message: keyError });
          span.setAttribute('error.code', error.code);
          return { valid: false, error };
        }

        if (request.nonce < 0) {
          const error: RelayError = {
            code: RelayErrorCodes.NONCE_REPLAY,
            message: 'Nonce must be non-negative',
          };
          logNonceReplay(request, options?.clientIp);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.setAttribute('error.code', error.code);
          return { valid: false, error };
        }

        if (this.nonceStore) {
          try {
            await this.nonceStore.assertFresh(request.sessionKey, request.nonce);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Nonce already used';
            const error: RelayError = { code: RelayErrorCodes.NONCE_REPLAY, message };
            logNonceReplay(request, options?.clientIp);
            span.setStatus({ code: SpanStatusCode.ERROR, message });
            span.setAttribute('error.code', error.code);
            return { valid: false, error };
          }
        }

        const signedNonce = options?.signedNonce ?? request.nonce;
        const payload = this.canonicalPayload({ ...request, nonce: signedNonce });

        try {
          const targetContract = request.parameters.accountAddress as string;
          const { RPC_URL, NETWORK_PASSPHRASE } = getEnv();
          const onChainKey = await getSessionKey(targetContract, request.sessionKey, {
            server: new rpc.Server(RPC_URL) as unknown as Parameters<
              typeof getSessionKey
            >[2]['server'],
            sourceAccount: targetContract,
            networkPassphrase: NETWORK_PASSPHRASE,
          });
          if (!onChainKey) {
            const error: RelayError = {
              code: RelayErrorCodes.INVALID_SIGNATURE,
              message: 'Session key not found on chain',
            };
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            span.setAttribute('error.code', error.code);
            return { valid: false, error };
          }
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Unable to verify session key on chain';
          const error: RelayError = {
            code: RelayErrorCodes.INVALID_SIGNATURE,
            message: `Session key verification unavailable: ${message}`,
          };
          span.recordException(e instanceof Error ? e : new Error(String(e)));
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.setAttribute('error.code', error.code);
          return { valid: false, error };
        }

        const ok = this.signatureService.verify(request.sessionKey, payload, request.signature);
        if (!ok) {
          const error: RelayError = {
            code: RelayErrorCodes.INVALID_SIGNATURE,
            message: 'Signature verification failed',
          };
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.setAttribute('error.code', error.code);
          return { valid: false, error };
        }

        if (request.transferPolicy) {
          const { policy, amount, todayTotal, assetCode, stepUpConfirmed } = request.transferPolicy;
          const policyCheck = validateTransferPolicyConstraints({
            amount,
            todayTotal,
            policy,
            assetCode,
            stepUpConfirmed,
          });
          if (!policyCheck.valid || policyCheck.requiresStepUp) {
            const error: RelayError = policyCheck.error ?? {
              code: RelayErrorCodes.POLICY_DENIED,
              message: 'This transfer requires additional confirmation.',
            };
            span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
            span.setAttribute('error.code', error.code);
            return {
              valid: false,
              requiresStepUp: policyCheck.requiresStepUp,
              error,
            };
          }
        }

        span.setStatus({ code: SpanStatusCode.OK });
        return { valid: true };
      } finally {
        span.end();
      }
    });
  }

  async executeRelay(
    request: RelayExecuteRequest,
    options?: RelayExecutionOptions
  ): Promise<RelayExecuteResponse> {
    const validateStart = Date.now();
    const validation = await this.validateRelay(request, options);
    relaySubmissionDuration.observe('validate', (Date.now() - validateStart) / 1000);
    if (!validation.valid || validation.requiresStepUp) {
      return {
        success: false,
        error: validation.error ?? {
          code: RelayErrorCodes.POLICY_DENIED,
          message: 'This transfer requires additional confirmation.',
        },
        gasUsed: 0,
      };
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
          code: RelayErrorCodes.INTERNAL_ERROR,
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
          code: RelayErrorCodes.INTERNAL_ERROR,
          message: `Missing required parameter: ${SIGNED_TX_PARAMETER}`,
        },
        gasUsed: 0,
      };
    }

    try {
      const { assembledXdr, gasUsed } = await tracer.startActiveSpan(
        'relayer.simulate',
        async (span) => {
          span.setAttribute('signed_xdr_length', signedXdr.length);
          try {
            const result =
              await this.transactionSubmitter!.simulateAndAssembleTransaction(signedXdr);
            span.setAttribute('gas_used', result.gasUsed);
            span.setAttribute('assembled_xdr_length', result.assembledXdr.length);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Simulation failed';
            span.setStatus({ code: SpanStatusCode.ERROR, message });
            span.recordException(err instanceof Error ? err : new Error(String(err)));
            throw err;
          } finally {
            span.end();
          }
        }
      );

      const submitStart = Date.now();
      const result = await tracer.startActiveSpan('relayer.submit', async (span) => {
        span.setAttribute('assembled_xdr_length', assembledXdr.length);
        try {
          const submitResult =
            await this.transactionSubmitter!.submitSignedTransaction(assembledXdr);
          span.setAttribute('transaction_hash', submitResult.transactionHash);
          span.setStatus({ code: SpanStatusCode.OK });
          return submitResult;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Submission failed';
          span.setStatus({ code: SpanStatusCode.ERROR, message });
          span.recordException(err instanceof Error ? err : new Error(String(err)));
          throw err;
        } finally {
          span.end();
        }
      });
      const submitDurationSeconds = (Date.now() - submitStart) / 1000;
      recordSubmitLatency(submitDurationSeconds);
      relaySubmissionDuration.observe('execute', submitDurationSeconds);

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

  async checkSignatureServiceHealth(): Promise<DependencyStatus> {
    if (!this.signatureService.isHealthy) {
      return { status: 'ok', message: 'Health check not implemented' };
    }

    const timeoutMs = getEnv().SIGNATURE_SERVICE_HEALTH_TIMEOUT_MS;

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

  // Delegates to the shared builder (../payload/builder) rather than
  // re-serializing inline, so the client (core-sdk's relay-payload.ts) and
  // server can never drift on what's actually covered by the signature.
  // That drift previously left `to`/`amount`/`asset` unsigned entirely — a
  // valid signature could be replayed with substituted transfer parameters.
  private canonicalPayload(req: RelayExecuteRequest): string {
    const parameters = req.parameters as { to?: unknown; amount?: unknown; asset?: unknown };
    return buildCanonicalPayload({
      sessionKey: req.sessionKey,
      operation: req.operation,
      nonce: req.nonce,
      to: typeof parameters.to === 'string' ? parameters.to : '',
      amount: typeof parameters.amount === 'string' ? parameters.amount : '',
      asset: typeof parameters.asset === 'string' ? parameters.asset : '',
    });
  }
}
