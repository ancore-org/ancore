import { Keypair } from '@stellar/stellar-sdk';
import { Ed25519SignatureService } from '../ed25519SignatureService';

function makeHexKeypair() {
  const kp = Keypair.random();
  // rawPublicKey() returns the 32-byte key as Buffer
  const pubHex = Buffer.from(kp.rawPublicKey()).toString('hex');
  return { kp, pubHex };
}

describe('Ed25519SignatureService', () => {
  const svc = new Ed25519SignatureService();

  it('verifies a valid signature', () => {
    const { kp, pubHex } = makeHexKeypair();
    const payload = 'relay:nonce:42';
    const sigBytes = kp.sign(Buffer.from(payload, 'utf8'));
    const sigHex = Buffer.from(sigBytes).toString('hex');

    expect(svc.verify(pubHex, payload, sigHex)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const { kp, pubHex } = makeHexKeypair();
    const payload = 'relay:nonce:42';
    const sigBytes = kp.sign(Buffer.from(payload, 'utf8'));
    const sigHex = Buffer.from(sigBytes).toString('hex');

    expect(svc.verify(pubHex, 'relay:nonce:99', sigHex)).toBe(false);
  });

  it('rejects a signature from a different keypair', () => {
    const { pubHex } = makeHexKeypair();
    const other = Keypair.random();
    const payload = 'relay:nonce:42';
    const sigBytes = other.sign(Buffer.from(payload, 'utf8'));
    const sigHex = Buffer.from(sigBytes).toString('hex');

    expect(svc.verify(pubHex, payload, sigHex)).toBe(false);
  });

  it('returns false for malformed public key', () => {
    expect(svc.verify('not-hex', 'payload', 'a'.repeat(128))).toBe(false);
  });

  it('returns false for wrong-length public key', () => {
    expect(svc.verify('abcd', 'payload', 'a'.repeat(128))).toBe(false);
  });

  it('returns false for wrong-length signature', () => {
    const { pubHex } = makeHexKeypair();
    expect(svc.verify(pubHex, 'payload', 'deadbeef')).toBe(false);
  });
});
