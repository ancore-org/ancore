#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { Keypair } from '@stellar/stellar-sdk';

const payloads = [
  '',
  'a',
  'Ancore intent: authorize',
  'transfer:10000000:XLM:testnet',
  '0'.repeat(31),
  '1'.repeat(32),
  '2'.repeat(64),
  'edge:'.padEnd(257, 'x'),
];

const vectors = payloads.map((payload, index) => {
  const keypair = Keypair.random();
  const payloadBytes = Buffer.from(payload, 'utf8');

  return {
    name: `ed25519-${index + 1}-${payloadBytes.length}b`,
    curve: 'ed25519',
    encoding: 'utf8',
    payload,
    secret: keypair.secret(),
    publicKey: keypair.publicKey(),
    signature: keypair.sign(payloadBytes).toString('hex'),
  };
});

writeFileSync(
  new URL('../src/__tests__/vectors/stellar-ed25519-signing.json', import.meta.url),
  `${JSON.stringify(vectors, null, 2)}\n`
);
