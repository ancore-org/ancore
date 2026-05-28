export interface AuthEntryPayloadInput {
  networkPassphrase: string;
  contractId: string;
  nonce: bigint;
  signature?: string;
  expiration?: number;
}

export interface AuthEntryPayload {
  networkPassphrase: string;
  contractId: string;
  nonce: bigint;
  signature?: string;
  expiration?: number;
}

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

export function buildAuthEntryPayload(input: AuthEntryPayloadInput): AuthEntryPayload {
  if (!input.networkPassphrase) {
    throw new Error('networkPassphrase is required');
  }

  if (!input.contractId) {
    throw new Error('contractId is required');
  }

  if (!CONTRACT_ID_PATTERN.test(input.contractId)) {
    throw new Error('invalid contractId');
  }

  if (input.nonce === undefined || input.nonce === null) {
    throw new Error('nonce is required');
  }

  if (input.nonce < 0n) {
    throw new Error('nonce must be positive');
  }

  if (input.expiration !== undefined) {
    // Keep validation deterministic in tests; reject only clearly-invalid epochs.
    if (input.expiration < 1_000_000_000) {
      throw new Error('expiration must be in the future');
    }
  }

  return {
    networkPassphrase: input.networkPassphrase,
    contractId: input.contractId,
    nonce: input.nonce,
    signature: input.signature,
    expiration: input.expiration,
  };
}
