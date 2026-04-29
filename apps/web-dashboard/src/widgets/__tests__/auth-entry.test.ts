import { describe, it, expect } from 'vitest';
import { buildAuthEntryPayload, type AuthEntryPayloadInput } from '../auth-entry';

describe('Auth-Entry Payload Builder - Test Matrix', () => {
  // Stable fixture to prevent test flakiness
  const defaultValidInput: AuthEntryPayloadInput = {
    networkPassphrase: 'Test SDF Network ; September 2015',
    contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
    nonce: 12345n,
    signature: 'base64SignatureStr==',
    expiration: 1700000000,
  };

  describe('Valid Permutations', () => {
    const validMatrix = [
      {
        scenario: 'all valid fields provided',
        input: { ...defaultValidInput },
      },
      {
        scenario: 'missing optional signature',
        input: { ...defaultValidInput, signature: undefined },
      },
      {
        scenario: 'missing optional expiration',
        input: { ...defaultValidInput, expiration: undefined },
      },
      {
        scenario: 'boundary value: nonce is 0',
        input: { ...defaultValidInput, nonce: 0n },
      },
      {
        scenario: 'boundary value: large nonce',
        input: { ...defaultValidInput, nonce: BigInt(Number.MAX_SAFE_INTEGER) },
      },
      {
        scenario: 'boundary value: future expiration',
        input: { ...defaultValidInput, expiration: 2000000000 },
      },
    ];

    it.each(validMatrix)('builds payload successfully - $scenario', ({ input }) => {
      const payload = buildAuthEntryPayload(input);
      
      expect(payload).toBeDefined();
      expect(payload.contractId).toBe(input.contractId);
      expect(payload.nonce).toBe(input.nonce);
      
      if (input.signature) {
        expect(payload.signature).toBe(input.signature);
      }
      if (input.expiration) {
        expect(payload.expiration).toBe(input.expiration);
      }
    });
  });

  describe('Invalid Permutations & Boundaries', () => {
    const invalidMatrix = [
      {
        scenario: 'missing contractId',
        input: { ...defaultValidInput, contractId: undefined as unknown as string },
        expectedError: /contractId is required/i,
      },
      {
        scenario: 'invalid contractId format',
        input: { ...defaultValidInput, contractId: 'invalid-contract-id' },
        expectedError: /invalid contractId/i,
      },
      {
        scenario: 'missing nonce',
        input: { ...defaultValidInput, nonce: undefined as unknown as bigint },
        expectedError: /nonce is required/i,
      },
      {
        scenario: 'negative nonce (boundary)',
        input: { ...defaultValidInput, nonce: -1n },
        expectedError: /nonce must be positive/i,
      },
      {
        scenario: 'missing networkPassphrase',
        input: { ...defaultValidInput, networkPassphrase: undefined as unknown as string },
        expectedError: /networkPassphrase is required/i,
      },
      {
        scenario: 'past expiration date (boundary)',
        input: { ...defaultValidInput, expiration: 1000 },
        expectedError: /expiration must be in the future/i,
      },
    ];

    it.each(invalidMatrix)('throws error - $scenario', ({ input, expectedError }) => {
      expect(() => buildAuthEntryPayload(input)).toThrowError(expectedError);
    });
  });
});