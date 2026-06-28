import type { RelayError } from '../types';

/**
 * Map Soroban simulation failures to typed relay errors.
 *
 * Returns `null` when the input does not look like a simulation error so the
 * caller can fall back to {@link mapSubmissionError} or another classifier.
 *
 * Known mappings:
 *  - Soroban host function / contract simulation failures → `SIMULATION_FAILED`
 *  - Resource budget exhaustion (fee/CPU/memory) → `GAS_LIMIT_EXCEEDED`
 */
export function mapSimulationError(error: unknown): RelayError | null {
  const message = extractMessage(error);
  if (!message) return null;

  const haystack = message.toLowerCase();

  if (
    haystack.includes('resource') ||
    haystack.includes('budget exceeded') ||
    haystack.includes('out of gas')
  ) {
    return { code: 'GAS_LIMIT_EXCEEDED', message };
  }

  if (
    haystack.includes('simulation') ||
    haystack.includes('simulate') ||
    haystack.includes('host_function_failed') ||
    haystack.includes('invokehostfunction') ||
    haystack.includes('insufficient balance')
  ) {
    return { code: 'SIMULATION_FAILED', message };
  }

  return null;
}

function extractMessage(error: unknown): string | null {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return null;
}
