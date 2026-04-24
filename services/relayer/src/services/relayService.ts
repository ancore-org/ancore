import { randomBytes } from 'crypto';
import type {
  RelayServiceContract,
  SignatureServiceContract,
  RelayExecuteRequest,
  RelayExecuteResponse,
  ValidationResult,
  HealthResponse,
} from '../types';

const MOCK_GAS_USED = 21_000;
const startTime = Date.now();

/** Generate a deterministic-looking mock transaction ID */
function mockTxId(): string {
  return randomBytes(32).toString('hex').toUpperCase();
}

/**
 * Mock implementation of RelayServiceContract.
 *
 * Validates the request signature via SignatureServiceContract, then
 * simulates execution. Replace with real Soroban submission logic when ready.
 *
 * Security checks performed:
 *  - Signature verification (Ed25519 via SignatureServiceContract)
 *  - Nonce must be a non-negative integer (structural; replay tracking is out of scope for MVP)
 *  - Session key must be a 64-char hex string
 */
export class RelayService implements RelayServiceContract {
  constructor(private readonly signatureService: SignatureServiceContract) {}

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

    // TODO: replace with real Soroban transaction submission
    return { success: true, transactionId: mockTxId(), gasUsed: MOCK_GAS_USED };
  }

  health(): HealthResponse {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

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
