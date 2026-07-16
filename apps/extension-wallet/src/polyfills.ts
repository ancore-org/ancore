/**
 * Browser polyfills for Node-oriented deps (ed25519-hd-key, Ledger transport, etc.).
 * Must load before any crypto/wallet imports.
 */
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined>; browser?: boolean; version?: string };
  global?: typeof globalThis;
  Buffer?: typeof Buffer;
};

if (typeof g.global === 'undefined') {
  g.global = g;
}

g.Buffer = Buffer;

if (typeof g.process === 'undefined') {
  g.process = {
    env: { NODE_ENV: 'development' },
    browser: true,
    version: 'v20.0.0',
  };
} else if (!g.process.env) {
  g.process.env = { NODE_ENV: 'development' };
}
