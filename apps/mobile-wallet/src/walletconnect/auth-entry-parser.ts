/**
 * Parse Soroban authorization entry XDR for WalletConnect approval UI (SEP-43).
 */

export interface ParsedAuthEntry {
  contractId: string;
  functionName: string;
  subInvocations: number;
  rootInvocationPresent: boolean;
  /** Raw base64 XDR for signing. */
  entryXdr: string;
}

/**
 * Best-effort parse of a base64 SorobanAuthorizationEntry XDR.
 * Returns human-readable fields for the approval sheet.
 */
export function parseAuthEntryXdr(entryXdr: string): ParsedAuthEntry {
  if (!entryXdr || typeof entryXdr !== 'string') {
    throw new Error('Missing auth entry XDR');
  }

  let decoded: Buffer;
  try {
    decoded = Buffer.from(entryXdr.trim(), 'base64');
  } catch {
    throw new Error('Auth entry XDR is not valid base64');
  }

  if (decoded.length === 0) {
    throw new Error('Auth entry XDR is empty');
  }

  // SorobanAuthorizationEntry is a structured XDR payload. For the approval UI we
  // surface safe metadata without requiring a full stellar-sdk dependency in mobile.
  const contractId = extractAsciiToken(decoded, 'C') ?? 'Unknown contract';
  const functionName = extractFunctionSymbol(decoded) ?? 'Unknown function';

  return {
    contractId,
    functionName,
    subInvocations: countSubInvocations(decoded),
    rootInvocationPresent: decoded.length > 32,
    entryXdr,
  };
}

function extractAsciiToken(buffer: Buffer, prefix: string): string | undefined {
  const text = buffer.toString('utf8');
  const match = text.match(new RegExp(`${prefix}[A-Z0-9]{${prefix === 'C' ? 55 : 47}}`));
  return match?.[0];
}

function extractFunctionSymbol(buffer: Buffer): string | undefined {
  const text = buffer.toString('utf8');
  const match = text.match(/[a-z_][a-z0-9_]{2,31}/i);
  return match?.[0];
}

function countSubInvocations(buffer: Buffer): number {
  // Heuristic: count non-zero 4-byte length prefixes typical in XDR vectors.
  let count = 0;
  for (let i = 0; i < buffer.length - 4; i += 1) {
    const candidate = buffer.readUInt32BE(i);
    if (candidate > 0 && candidate < 16) {
      count += 1;
    }
  }
  return Math.min(count, 8);
}
