/**
 * Parse Soroban authorization entry XDR for WalletConnect approval UI (SEP-43).
 *
 * This is the "confirm what you're about to sign" screen for a security-sensitive
 * action, so the payload is decoded structurally via @stellar/stellar-sdk's XDR
 * codecs rather than guessed at from the raw bytes.
 */
import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';

export interface ParsedInvocation {
  contractId: string;
  functionName: string;
  args: string[];
  subInvocations: ParsedInvocation[];
}

export interface ParsedAuthEntry {
  contractId: string;
  functionName: string;
  /** Total number of invocations in the tree beneath the root (nested, recursive). */
  subInvocationCount: number;
  /** Full decoded invocation tree, for rendering nested sub-invocations. */
  invocation: ParsedInvocation;
  /** Raw base64 XDR for signing. */
  entryXdr: string;
}

/**
 * Structurally decodes a base64 SorobanAuthorizationEntry XDR into the fields
 * shown on the approval sheet. Throws if the XDR does not parse - callers must
 * not fall back to a best-guess rendering of unparseable input.
 */
export function parseAuthEntryXdr(entryXdr: string): ParsedAuthEntry {
  if (!entryXdr || typeof entryXdr !== 'string') {
    throw new Error('Missing auth entry XDR');
  }

  const trimmed = entryXdr.trim();
  let decodedLength: number;
  try {
    decodedLength = Buffer.from(trimmed, 'base64').length;
  } catch {
    throw new Error('Auth entry XDR is not valid base64');
  }

  if (decodedLength === 0) {
    throw new Error('Auth entry XDR is empty');
  }

  let entry: xdr.SorobanAuthorizationEntry;
  try {
    entry = xdr.SorobanAuthorizationEntry.fromXDR(trimmed, 'base64');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Auth entry XDR could not be structurally decoded: ${reason}`);
  }

  const invocation = parseInvocation(entry.rootInvocation());

  return {
    contractId: invocation.contractId,
    functionName: invocation.functionName,
    subInvocationCount: countInvocations(invocation),
    invocation,
    entryXdr,
  };
}

function parseInvocation(invocation: xdr.SorobanAuthorizedInvocation): ParsedInvocation {
  const { contractId, functionName, args } = parseAuthorizedFunction(invocation.function());
  const subInvocations = invocation.subInvocations().map(parseInvocation);

  return { contractId, functionName, args, subInvocations };
}

function parseAuthorizedFunction(fn: xdr.SorobanAuthorizedFunction): {
  contractId: string;
  functionName: string;
  args: string[];
} {
  switch (fn.switch().name) {
    case 'sorobanAuthorizedFunctionTypeContractFn': {
      const invokeArgs = fn.contractFn();
      const contractId = Address.fromScAddress(invokeArgs.contractAddress()).toString();
      const functionName = invokeArgs.functionName().toString();
      const args = invokeArgs.args().map(summarizeScVal);
      return { contractId, functionName, args };
    }
    case 'sorobanAuthorizedFunctionTypeCreateContractHostFn':
      return { contractId: '(contract creation)', functionName: 'create_contract', args: [] };
    case 'sorobanAuthorizedFunctionTypeCreateContractV2HostFn':
      return { contractId: '(contract creation)', functionName: 'create_contract_v2', args: [] };
    default:
      throw new Error(`Unsupported Soroban authorized function type: ${fn.switch().name}`);
  }
}

function summarizeScVal(value: xdr.ScVal): string {
  try {
    return summarizeNative(scValToNative(value));
  } catch {
    return `<unreadable ${value.switch().name}>`;
  }
}

function summarizeNative(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (Array.isArray(value)) return `[${value.map(summarizeNative).join(', ')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${summarizeNative(val)}`)
      .join(', ')}}`;
  }
  return String(value);
}

function countInvocations(invocation: ParsedInvocation): number {
  return invocation.subInvocations.reduce((total, sub) => total + 1 + countInvocations(sub), 0);
}
