import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { randomBytes } from 'node:crypto';
import { TransactionBuilder } from '../transaction-builder';
import { publicKeyToBytes32ScVal } from '../xdr-utils';

describe('TransactionBuilder', () => {
  const source = Keypair.random().publicKey();
  const contractId = StrKey.encodeContract(randomBytes(32));
  const validSessionKey = 'a'.repeat(64); // 64-char hex string
  const stellarPublicKey = Keypair.random().publicKey();

  it('should add a session key', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.addSessionKey(validSessionKey, [1], Date.now() + 60000);
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'add',
      sessionKey: validSessionKey,
      permissions: [1],
      expiresAt: expect.any(Number),
    });
  });

  it('should throw for invalid session key format', () => {
    const builder = new TransactionBuilder(source, contractId);
    expect(() => builder.addSessionKey('invalid', [1], Date.now() + 60000)).toThrow(
      'Session key must be a 64-character hex string'
    );
  });

  it('should revoke a session key', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.revokeSessionKey(validSessionKey);
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'revoke',
      sessionKey: validSessionKey,
      permissions: [],
      expiresAt: 0,
    });
  });

  it('should refresh a session key TTL', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.refreshSessionKeyTtl({ publicKey: stellarPublicKey, ttlSeconds: 3600 });
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'refreshTtl',
      sessionKey: stellarPublicKey,
      permissions: [],
      expiresAt: 0,
      ttlSeconds: 3600,
    });
  });

  it('should build refresh_session_key_ttl with BytesN<32> public key arg', async () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.refreshSessionKeyTtl({ publicKey: stellarPublicKey, ttlSeconds: 3600 });
    await builder.simulate();
    const tx = builder.build();
    expect(tx).toBeDefined();

    // @ts-expect-no-error private buildOperation for SCVal assertion
    const operation = builder['buildOperation'](builder['ops'][0]);
    const invokeArgs = operation
      .body()
      .invokeHostFunctionOp()
      .hostFunction()
      .invokeContract()
      .args();
    expect(invokeArgs[0].switch().name).toBe('scvBytes');
    expect(invokeArgs[0]).toEqual(publicKeyToBytes32ScVal(stellarPublicKey));
  });

  it('should throw for invalid refreshSessionKeyTtl params', () => {
    const builder = new TransactionBuilder(source, contractId);
    expect(() => builder.refreshSessionKeyTtl({ publicKey: '', ttlSeconds: 3600 })).toThrow(
      'refreshSessionKeyTtl requires a non-empty publicKey string'
    );
    expect(() =>
      builder.refreshSessionKeyTtl({ publicKey: validSessionKey, ttlSeconds: 0 })
    ).toThrow('refreshSessionKeyTtl requires ttlSeconds to be greater than zero');
  });

  it('should execute contract operations', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.execute(validSessionKey, [{ contractId: 'CID', method: 'foo', args: [1, 2] }]);
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'contractExecute',
      contractId: 'CID',
      method: 'foo',
      args: [1, 2],
    });
  });

  it('should add custom operations', () => {
    const builder = new TransactionBuilder(source, contractId);
    const mockOp = { body: { type: 0 } } as any;
    builder.addOperation(mockOp);
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'custom',
      operation: mockOp,
    });
  });

  it('should simulate and return fee estimates', async () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.addSessionKey(validSessionKey, [1], Date.now() + 60000);
    const result = await builder.simulate();
    expect(result.fee).toBeDefined();
    expect(result.operationCount).toBe(1);
    expect(result.minResourceFee).toBeDefined();
  });

  it('should build transaction after simulation', async () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.addSessionKey(validSessionKey, [1], Date.now() + 60000);
    await builder.simulate();
    const tx = builder.build();
    expect(tx).toBeDefined();
  });

  it('should throw error when build() called without simulate()', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.addSessionKey(validSessionKey, [1], Date.now() + 60000);
    expect(() => builder.build()).toThrow('Must call simulate() before build()');
  });

  it('should chain methods fluently', () => {
    const builder = new TransactionBuilder(source, contractId);
    const result = builder
      .addSessionKey(validSessionKey, [1], Date.now() + 60000)
      .revokeSessionKey(validSessionKey)
      .execute(validSessionKey, [{ contractId: 'CID', method: 'foo', args: [] }]);
    expect(result).toBe(builder);
  });

  it('should validate constructor parameters', () => {
    expect(() => new TransactionBuilder('', contractId)).toThrow(
      'TransactionBuilder requires a source account ID'
    );
    expect(() => new TransactionBuilder(source, '')).toThrow(
      'TransactionBuilder requires an account abstraction contract ID'
    );
  });
});
