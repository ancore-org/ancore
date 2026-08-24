import { Buffer } from 'node:buffer';
import { Keypair } from '@stellar/stellar-sdk';
import {
  buildRelayCanonicalPayload,
  buildSignedRelayPayload,
  type RelaySigner,
} from '../relay-payload';

/**
 * Same values as packages/test-fixtures/src/relay-payload-v1.json (the fixture
 * the relayer's own services/relayer/tests/unit/relay-payload.test.ts uses) —
 * mirrored inline here rather than as a workspace dependency, so this
 * cross-check has no new package wiring.
 */
const RELAY_PAYLOAD_V1_FIXTURE = {
  sessionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'.slice(0, 64),
  operation: 'relay_execute',
  nonce: 42,
};

describe('buildRelayCanonicalPayload — matches the relayer server byte-for-byte', () => {
  it('produces the same hex output as the server-side Buffer-based algorithm (relay-payload-v1 fixture)', () => {
    // Reimplementation of services/relayer/src/payload/builder.ts::buildCanonicalPayload,
    // using Node's Buffer directly (available in Jest/Node) as an independent
    // cross-check against our browser-safe TextEncoder-based client version.
    const ordered = {
      sessionKey: RELAY_PAYLOAD_V1_FIXTURE.sessionKey,
      operation: RELAY_PAYLOAD_V1_FIXTURE.operation,
      nonce: RELAY_PAYLOAD_V1_FIXTURE.nonce,
    };
    const expectedHex = Buffer.from(JSON.stringify(ordered), 'utf8').toString('hex');

    expect(buildRelayCanonicalPayload(RELAY_PAYLOAD_V1_FIXTURE)).toBe(expectedHex);
  });

  it('is deterministic and field-order-stable regardless of input key order', () => {
    const a = buildRelayCanonicalPayload({ sessionKey: 'aa', operation: 'op', nonce: 1 });
    const b = buildRelayCanonicalPayload({ nonce: 1, operation: 'op', sessionKey: 'aa' } as any);
    expect(a).toBe(b);
  });

  it('produces different output for different inputs', () => {
    const a = buildRelayCanonicalPayload({ sessionKey: 'aa', operation: 'op', nonce: 1 });
    const b = buildRelayCanonicalPayload({ sessionKey: 'aa', operation: 'op', nonce: 2 });
    expect(a).not.toBe(b);
  });
});

describe('buildSignedRelayPayload — real signature round-trip (issue #1213 acceptance criteria)', () => {
  function realSigner(kp: Keypair): RelaySigner {
    return {
      async signRelayEnvelope({ operation, nonce }) {
        const sessionKey = kp.rawPublicKey().toString('hex');
        const payloadHex = buildRelayCanonicalPayload({ sessionKey, operation, nonce });
        const signature = kp.sign(Buffer.from(payloadHex, 'utf8')).toString('hex');
        return { sessionKey, signature };
      },
    };
  }

  it('produces a signature that verifies with the same Ed25519 primitive the relayer uses', async () => {
    const kp = Keypair.random();
    const payload = await buildSignedRelayPayload('GDEST...', '100', realSigner(kp));

    // Re-derive the canonical payload exactly as the relayer's
    // Ed25519SignatureService does, and verify with a fresh Keypair
    // constructed purely from the public key (no shared object identity).
    const canonicalPayload = buildRelayCanonicalPayload({
      sessionKey: payload.sessionKey,
      operation: payload.operation,
      nonce: payload.nonce,
    });
    const verifier = Keypair.fromPublicKey(kp.publicKey());
    const verified = verifier.verify(
      Buffer.from(canonicalPayload, 'utf8'),
      Buffer.from(payload.signature, 'hex')
    );

    expect(verified).toBe(true);
  });

  it('rejects a request whose payload was tampered with after signing', async () => {
    const kp = Keypair.random();
    const payload = await buildSignedRelayPayload('GDEST...', '100', realSigner(kp));

    const tamperedCanonicalPayload = buildRelayCanonicalPayload({
      sessionKey: payload.sessionKey,
      operation: payload.operation,
      nonce: payload.nonce + 1, // attacker bumps the nonce after signing
    });

    const verifier = Keypair.fromPublicKey(kp.publicKey());
    const verified = verifier.verify(
      Buffer.from(tamperedCanonicalPayload, 'utf8'),
      Buffer.from(payload.signature, 'hex')
    );

    expect(verified).toBe(false);
  });

  it('rejects the old hardcoded fake sessionKey/signature against any real key — they never verify', () => {
    const canonicalPayload = buildRelayCanonicalPayload({
      sessionKey: 'a'.repeat(64),
      operation: 'relay_execute',
      nonce: 1,
    });
    const fakeSignature = Buffer.from('b'.repeat(128), 'hex');
    const someRealKeypair = Keypair.random();

    const verified = someRealKeypair.verify(Buffer.from(canonicalPayload, 'utf8'), fakeSignature);
    expect(verified).toBe(false);
  });
});
