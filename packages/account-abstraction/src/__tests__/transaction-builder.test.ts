import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { randomBytes } from 'node:crypto';
import { TransactionBuilder } from '../transaction-builder';
import { NotImplementedError } from '../errors';

describe('TransactionBuilder', () => {
  const source = Keypair.random().publicKey();
  const contractId = StrKey.encodeContract(randomBytes(32));

  it('should add a session key', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.addSessionKey('SKEY1', [1], Date.now() + 60000);
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'add',
      sessionKey: 'SKEY1',
      permissions: [1],
      expiresAt: expect.any(Number),
    });
  });

  it('should revoke a session key', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.revokeSessionKey('SKEY2');
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'sessionKey',
      op: 'revoke',
      sessionKey: 'SKEY2',
      permissions: [],
      expiresAt: 0,
    });
  });

  it('should add a contract execute op', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.executeContract({ contractId: 'CID', method: 'foo', args: [1, 2] });
    // @ts-expect-no-error: internal ops
    expect(builder['ops']).toContainEqual({
      type: 'contractExecute',
      contractId: 'CID',
      method: 'foo',
      args: [1, 2],
    });
  });

  it('should simulate and return a fee and operation count', async () => {
    const builder = new TransactionBuilder(source, contractId);
    const result = await builder.simulate();
    expect(result).toEqual({ fee: '10000', operationCount: 0 });
  });

  it('throws NotImplementedError when build() is called', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.revokeSessionKey('SKEY3');
    expect(() => builder.build()).toThrow(NotImplementedError);
  });

  it('build() error message references the README Limitations section', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.addSessionKey('SKEY4', [1], Date.now() + 60000);
    expect(() => builder.build()).toThrow(/README\.md#limitations/i);
  });

  it('build() error message names Soroban envelope construction', () => {
    const builder = new TransactionBuilder(source, contractId);
    builder.executeContract({ contractId: 'CID', method: 'foo', args: [] });
    expect(() => builder.build()).toThrow(/Soroban envelope construction/i);
  });

  it('build() throws even with no operations queued', () => {
    const builder = new TransactionBuilder(source, contractId);
    expect(() => builder.build()).toThrow(NotImplementedError);
  });
});
