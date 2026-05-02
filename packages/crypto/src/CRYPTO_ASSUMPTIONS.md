# Crypto assumptions

- Mnemonic generation only produces 12-word BIP39 phrases.
- Mnemonic import and derivation accept only normalized 12-word phrases in the standard wordlist casing.
- BIP39 passphrases are not supported; derivation always uses the bare mnemonic with the `mnemonic` salt prefix.
- Stellar key derivation uses the hardened path `m/44'/148'/{index}'`.
- Secret material encryption uses PBKDF2-SHA256 with 100000 iterations and AES-256-GCM.
- Signature helpers only support Stellar Ed25519 transaction envelopes and raw message verification.

# Unsupported scenarios

- 15, 18, 21, or 24-word public mnemonic validation through `validateMnemonic`.
- Hardware-wallet signing flows.
- Alternative key curves or derivation paths.
- User-provided BIP39 passphrases.
- Cross-chain signature formats or non-Stellar transaction encodings.
