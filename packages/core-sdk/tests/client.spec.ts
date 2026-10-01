import { Keypair, StrKey } from '@stellar/stellar-sdk';
import {
  AncoreClient,
  createSmartAccount,
  deriveContractId,
  BuilderValidationError,
} from '../src/index';

describe('AncoreClient.createSmartAccount factory (tests/client.spec.ts)', () => {
  const mockOwner = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';

  it('creates an initialized AncoreClient with derived contract ID from public key (one-liner)', () => {
    const client = AncoreClient.createSmartAccount(mockOwner);

    expect(client).toBeInstanceOf(AncoreClient);
    expect(client.accountContractId).toBe(deriveContractId(mockOwner, 'testnet'));
    expect(StrKey.isValidContract(client.accountContractId)).toBe(true);
  });

  it('creates an initialized AncoreClient via standalone createSmartAccount function', () => {
    const client = createSmartAccount(mockOwner);

    expect(client).toBeInstanceOf(AncoreClient);
    expect(client.accountContractId).toBe(deriveContractId(mockOwner, 'testnet'));
  });

  it('supports network parameter override (e.g. mainnet, futurenet)', () => {
    const clientTestnet = AncoreClient.createSmartAccount(mockOwner, { network: 'testnet' });
    const clientMainnet = AncoreClient.createSmartAccount(mockOwner, { network: 'mainnet' });

    expect(clientTestnet.accountContractId).not.toBe(clientMainnet.accountContractId);
    expect(clientMainnet.accountContractId).toBe(deriveContractId(mockOwner, 'mainnet'));
  });

  it('preserves explicit accountContractId if provided in options', () => {
    const explicitContractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
    const client = AncoreClient.createSmartAccount(mockOwner, {
      accountContractId: explicitContractId,
    });

    expect(client.accountContractId).toBe(explicitContractId);
  });

  it('accepts contract ID directly as publicKey parameter', () => {
    const explicitContractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
    const client = AncoreClient.createSmartAccount(explicitContractId);

    expect(client.accountContractId).toBe(explicitContractId);
  });

  it('forwards retryOptions to client instance', async () => {
    const client = AncoreClient.createSmartAccount(mockOwner, {
      retryOptions: { maxRetries: 4, baseDelayMs: 20 },
    });

    let attempts = 0;
    const res = await client.withRetry(async () => {
      attempts++;
      if (attempts < 2) throw new Error('read ECONNRESET');
      return 'ok';
    });

    expect(res).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws BuilderValidationError if publicKey is empty', () => {
    expect(() => AncoreClient.createSmartAccount('')).toThrow(BuilderValidationError);
  });

  it('can build invocations from initialized client', () => {
    const client = AncoreClient.createSmartAccount(mockOwner);
    const sessionKey = Keypair.random().publicKey();

    const addInvocation = client.addSessionKey({
      publicKey: sessionKey,
      permissions: [0],
      expiresAt: 1800000000,
    });

    expect(addInvocation.method).toBe('add_session_key');

    const revokeInvocation = client.revokeSessionKey({
      publicKey: sessionKey,
    });

    expect(revokeInvocation.method).toBe('revoke_session_key');
  });
});
