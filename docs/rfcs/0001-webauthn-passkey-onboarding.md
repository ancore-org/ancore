# RFC: WebAuthn Passkey Onboarding for P-256 Session Key Registration Flow

- **RFC Number**: 0001
- **Author**: oluebubejoy
- **Status**: Proposed
- **Created**: 2026-06-28
- **Updated**: 2026-06-28

## Summary

This RFC specifies the WebAuthn/Passkey onboarding and transaction signing flow for Ancore. By introducing P-256 (secp256r1) credential registration as smart account session keys, users can onboard and execute transactions using biometrics (TouchID, FaceID, Windows Hello) without managing seed phrases, establishing WebAuthn as the primary UX differentiator for Ancore's Account Abstraction (AA) model.

## Motivation

Traditional non-custodial wallets force users to manage seed phrases on first launch, causing massive friction for mainstream users. Account Abstraction enables smart contract-defined authorization rules. By supporting WebAuthn keys as session keys, Ancore allows users to:
1. Onboard securely with a passkey.
2. Sign transactions using secure hardware (Enclaves) on their personal devices.
3. Keep their account recovery path backed by traditional seed-phrases/passwords as a fallback.

## Detailed Design

### Cryptographic Bridge: P-256 vs Ed25519

Stellar and Soroban natively support Ed25519 signatures. WebAuthn authenticators utilize the P-256 (secp256r1) elliptic curve. To bridge these:
- **Contract Signature Verification**: The account contract must verify P-256 signatures. Soroban SDK provides host functions for verifying signatures over other curves. We will implement verification using `secp256r1_verify` directly in the contract logic, treating P-256 keys as a distinct class of session keys.
- **Attestation Wrapping**: Passkey signatures include authenticator data (`authData`) and client data JSON (`clientDataJSON`). The client-side SDK wraps the raw signature, `authData`, and `clientDataJSON` into a structured envelope for contract verification.

### Registration Flow

1. **Key Generation**:
   The client triggers WebAuthn credential creation:
   ```javascript
   const credential = await navigator.credentials.create({
     publicKey: {
       challenge: crypto.getRandomValues(new Uint8Array(32)),
       rp: { name: "Ancore Wallet" },
       user: {
         id: crypto.getRandomValues(new Uint8Array(16)),
         name: "user@ancore.org",
         displayName: "Ancore User"
       },
       pubKeyCredParams: [{ alg: -7, type: "public-key" }] // ES256 (P-256)
     }
   });
   ```
2. **Key Extraction**:
   Extract the P-256 public key bytes from the credential's `attestationObject`.
3. **Session Key Registration**:
   Submit the public key to the account contract via `add_session_key()` with permissions and expiry.

### Sign Flow

1. **Challenge Construction**:
   Construct the transaction signature payload (the relay payload hash) and use it as the WebAuthn challenge.
2. **Signature Request**:
   ```javascript
   const assertion = await navigator.credentials.get({
     publicKey: {
       challenge: payloadHash,
       allowCredentials: [{ id: credentialId, type: "public-key" }]
     }
   });
   ```
3. **DER Normalization**:
   The authenticator returns a DER-encoded signature `(r, s)`. To prevent signature malleability, normalize `s` to its low-s value.
4. **Relay Submission**:
   Send the signature, `clientDataJSON`, and `authData` to the Ancore relayer.

### Fallback Path

- **Primary**: WebAuthn Passkey stored in local secure hardware.
- **Recovery**: Traditional master password and recovery phrase (seed phrase) created during onboarding but hidden behind advanced settings. If the user loses their device, the recovery key (Ed25519 master key) can revoke the passkey session key and register a new one.

## Security Considerations

- **Non-Exportability**: Passkeys generated inside hardware security modules (Secure Enclave) cannot be extracted or leaked via phishing.
- **Malleability Protection**: Signature verification enforces low-s normalization.
- **Replay Protection**: The account contract tracks nonces for all executed transactions, including those authorized by WebAuthn session keys.

## Adoption Strategy

This is a non-breaking additive feature to the existing Ed25519 session key model. The `@ancore/wallet-api` and `@ancore/core-sdk` packages will wrap these details so dApps see standard session key requests.

## Unresolved Questions

- The gas overhead of running P-256 verification (via host functions or Wasm verification library) on-chain under Soroban resource limits.
