import { Address, xdr } from '@stellar/stellar-sdk';

import {
  bytes32ScValToPublicKey,
  decodeAddSessionKeyArgs,
  decodeExecuteArgs,
  decodeExecuteResult,
  decodeGetSessionKeyArgs,
  decodeInitializeArgs,
  decodeNonceResult,
  decodeOwnerResult,
  decodeRevokeSessionKeyArgs,
  decodeSessionKeyResult,
  decodeVoidResult,
  encodeAddSessionKeyArgs,
  encodeExecuteArgs,
  encodeGetSessionKeyArgs,
  encodeInitializeArgs,
  encodeRevokeSessionKeyArgs,
  sessionKeyToScVal,
} from '../xdr-utils';

const OWNER_ADDRESS = 'GCM5WPR4DDR24FSAX5LIEM4J7AI3KOWJYANSXEPKYXCSZOTAYXE75AFN';
const CONTRACT_ADDRESS = 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE';

describe('account abstraction XDR helpers', () => {
  it('round-trips initialize args', () => {
    const encoded = encodeInitializeArgs({ owner: OWNER_ADDRESS });

    expect(decodeInitializeArgs(encoded)).toEqual({ owner: OWNER_ADDRESS });
  });

  it('round-trips execute args', () => {
    const innerArgs = [
      new Address(OWNER_ADDRESS).toScVal(),
      xdr.ScVal.scvU32(7),
      xdr.ScVal.scvBool(true),
    ];

    const encoded = encodeExecuteArgs({
      to: CONTRACT_ADDRESS,
      functionName: 'transfer',
      args: innerArgs,
      expectedNonce: 9,
    });

    const decoded = decodeExecuteArgs(encoded);

    expect(decoded.to).toBe(CONTRACT_ADDRESS);
    expect(decoded.functionName).toBe('transfer');
    expect(decoded.expectedNonce).toBe(9);
    expect(decoded.args).toHaveLength(3);
  });

  it('round-trips add_session_key args', () => {
    const encoded = encodeAddSessionKeyArgs({
      publicKey: OWNER_ADDRESS,
      expiresAt: 1700000000,
      permissions: [0, 2],
    });

    expect(decodeAddSessionKeyArgs(encoded)).toEqual({
      publicKey: OWNER_ADDRESS,
      expiresAt: 1700000000,
      permissions: [0, 2],
    });
  });

  it('round-trips revoke_session_key args', () => {
    const encoded = encodeRevokeSessionKeyArgs({ publicKey: OWNER_ADDRESS });

    expect(decodeRevokeSessionKeyArgs(encoded)).toEqual({
      publicKey: OWNER_ADDRESS,
    });
  });

  it('round-trips get_session_key args', () => {
    const encoded = encodeGetSessionKeyArgs({ publicKey: OWNER_ADDRESS });

    expect(decodeGetSessionKeyArgs(encoded)).toEqual({
      publicKey: OWNER_ADDRESS,
    });
  });

  it('round-trips session key result decoding', () => {
    const scVal = sessionKeyToScVal({
      publicKey: OWNER_ADDRESS,
      expiresAt: 1700000000,
      permissions: [0, 1, 2],
    });

    expect(decodeSessionKeyResult(scVal)).toEqual({
      publicKey: OWNER_ADDRESS,
      expiresAt: 1700000000,
      permissions: [0, 1, 2],
    });
  });

  it('decodes owner and nonce results', () => {
    expect(decodeOwnerResult(new Address(OWNER_ADDRESS).toScVal())).toBe(OWNER_ADDRESS);
    expect(decodeNonceResult(xdr.ScVal.scvU64(new xdr.Uint64(42n)))).toBe(42);
  });

  it('decodes execute and void results', () => {
    expect(decodeExecuteResult(xdr.ScVal.scvBool(true))).toBe(true);
    expect(() => decodeVoidResult(xdr.ScVal.scvVoid())).not.toThrow();
  });

  it('preserves public key bytes deterministically', () => {
    const encoded = encodeGetSessionKeyArgs({ publicKey: OWNER_ADDRESS });

    expect(bytes32ScValToPublicKey(encoded[0])).toBe(OWNER_ADDRESS);
  });
});
