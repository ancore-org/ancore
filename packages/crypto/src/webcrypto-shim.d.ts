// TypeScript type shims for WebCrypto API in Node.js environments
// This allows the use of Crypto and CryptoKey types for TS builds

declare type Crypto = typeof globalThis.crypto;
declare type CryptoKey = globalThis.CryptoKey;
