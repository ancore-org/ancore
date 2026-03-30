import { TransactionBuilder } from '../transaction-builder';

describe('TransactionBuilder', () => {
  const source = 'GABC...';
  it('should add a session key', () => {
    const builder = new TransactionBuilder(source);
    builder.addSessionKey('SKEY1');
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({ type: 'sessionKey', op: 'add', sessionKey: 'SKEY1' });
  });

  it('should revoke a session key', () => {
    const builder = new TransactionBuilder(source);
    builder.revokeSessionKey('SKEY2');
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'revoke',
      sessionKey: 'SKEY2',
    });
  });

  it('should add a contract execute op', () => {
    const builder = new TransactionBuilder(source);
    builder.executeContract({ contractId: 'CID', method: 'foo', args: [1, 2] });
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'contractExecute',
      contractId: 'CID',
      method: 'foo',
      args: [1, 2],
    });
  });

  it('should simulate and return a fee', async () => {
    const builder = new TransactionBuilder(source);
    const result = await builder.simulate();
    expect(result).toHaveProperty('fee');
  });

  it('should build a transaction (placeholder)', () => {
    const builder = new TransactionBuilder(source);
    const tx = builder.build();
    // Placeholder: expect undefined until implemented
    expect(tx).toBeUndefined();
  });
});
