/**
 * Type definitions for the @ancore/crypto package
 *
 * This module provides TypeScript interfaces and types for all cryptographic operations
 * in the non-custodial Stellar wallet. All types include comprehensive JSDoc documentation
 * describing constraints, formats, and validation rules.
 *
 * @module types
 */

/**
 * Represents a Stellar keypair containing both public and secret keys.
 *
 * @interface Keypair
 * @property {string} publicKey - Stellar public key in G-address format
 *   - Must start with 'G'
 *   - Must be exactly 56 characters long
 *   - Base32-encoded Ed25519 public key
 *   - Example: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"
 *
 * @property {string} secretKey - Stellar secret key in S-key format
 *   - Must start with 'S'
 *   - Must be exactly 56 characters long
 *   - Base32-encoded Ed25519 secret key
 *   - Example: "SBZVMB74NZNCJYEQVQHQKUDGKZXVLAUSPYAI2VJABQV3KQIQKLSXJVGW"
 *   - SECURITY: Must NEVER be transmitted over network
 *   - SECURITY: Must be zeroed from memory after use
 *   - SECURITY: Must only be stored in encrypted form
 *
 * @remarks
 * Keypairs are derived from BIP39 mnemonics using the Stellar HD derivation path
 * m/44'/148'/n' where n is the account index. The same mnemonic and account index
 * will always produce the same keypair (deterministic derivation).
 *
 * @see {@link https://developers.stellar.org/docs/glossary/accounts | Stellar Accounts}
 * @see {@link https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md | SEP-0005: Key Derivation}
 */
export interface Keypair {
  publicKey: string;
  secretKey: string;
}

/**
 * Represents encrypted data with all metadata required for decryption.
 *
 * @interface EncryptedData
 * @property {Uint8Array} ciphertext - Encrypted data with authentication tag
 *   - Contains the encrypted secret key
 *   - Includes 16-byte Poly1305 authentication tag appended to ciphertext
 *   - Length = plaintext length + 16 bytes
 *   - Provides both confidentiality and integrity (AEAD)
 *
 * @property {Uint8Array} salt - PBKDF2 salt for key derivation
 *   - Must be exactly 32 bytes (256 bits)
 *   - Must be cryptographically random
 *   - Must be unique per encryption operation
 *   - Used to derive encryption key from password
 *   - Prevents rainbow table attacks
 *
 * @property {Uint8Array} nonce - XChaCha20 nonce for encryption
 *   - Must be exactly 24 bytes (192 bits)
 *   - Must be cryptographically random
 *   - Must be unique per encryption operation
 *   - Extended nonce size (vs ChaCha20's 12 bytes) prevents nonce reuse
 *   - Never reuse the same nonce with the same key
 *
 * @remarks
 * This structure contains all data needed to decrypt a secret key:
 * 1. Salt is used with password to derive the encryption key via PBKDF2
 * 2. Derived key and nonce are used to decrypt the ciphertext via XChaCha20-Poly1305
 * 3. Poly1305 tag ensures data integrity and authenticity
 *
 * The same secret key encrypted multiple times will produce different ciphertexts
 * due to unique random salts and nonces.
 *
 * @see {@link https://datatracker.ietf.org/doc/html/rfc8439 | RFC 8439: ChaCha20-Poly1305}
 */
export interface EncryptedData {
  ciphertext: Uint8Array;
  salt: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Represents password strength analysis results.
 *
 * @interface PasswordStrength
 * @property {number} score - Password strength score from zxcvbn algorithm
 *   - Range: 0 (weakest) to 4 (strongest)
 *   - 0: Too guessable (risky password)
 *   - 1: Very guessable (protection from throttled online attacks)
 *   - 2: Somewhat guessable (protection from unthrottled online attacks)
 *   - 3: Safely unguessable (moderate protection from offline slow-hash attacks)
 *   - 4: Very unguessable (strong protection from offline slow-hash attacks)
 *
 * @property {string[]} feedback - Actionable suggestions for password improvement
 *   - Empty array if password is strong (score >= 3)
 *   - Contains specific recommendations if password is weak
 *   - Examples: "Add another word or two", "Avoid common patterns"
 *   - User-friendly messages suitable for display
 *
 * @property {boolean} isValid - Whether password meets minimum security requirements
 *   - true if and only if score >= 3
 *   - Passwords with score < 3 should be rejected
 *   - Ensures users create sufficiently strong passwords
 *
 * @remarks
 * Password strength is evaluated using the zxcvbn algorithm, which considers:
 * - Common passwords and dictionary words
 * - Keyboard patterns (qwerty, asdf)
 * - Repeated characters (aaa, 111)
 * - Sequential characters (abc, 123)
 * - Date patterns
 * - Name patterns
 *
 * A minimum score of 3 is required to protect against offline brute force attacks
 * when combined with PBKDF2 key derivation (100,000 iterations).
 *
 * @see {@link https://github.com/dropbox/zxcvbn | zxcvbn: Low-Budget Password Strength Estimation}
 */
export interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

/**
 * Options for BIP39 mnemonic generation.
 *
 * @interface MnemonicOptions
 * @property {128 | 256} [strength=128] - Entropy strength in bits
 *   - 128 bits: Generates 12-word mnemonic (default)
 *   - 256 bits: Generates 24-word mnemonic
 *   - Higher strength provides more security but longer phrases
 *   - 128 bits provides ~2^128 possible mnemonics (sufficient for most use cases)
 *   - 256 bits provides ~2^256 possible mnemonics (maximum security)
 *
 * @property {string[]} [wordlist] - BIP39 wordlist for mnemonic generation
 *   - Default: English wordlist (2048 words)
 *   - Must be a valid BIP39 wordlist if provided
 *   - Supported languages: English, Spanish, French, Italian, Japanese, Korean, Chinese
 *   - All wordlists contain exactly 2048 words
 *   - Words are carefully chosen to avoid confusion (no similar words)
 *
 * @remarks
 * BIP39 mnemonics encode entropy with a checksum for error detection:
 * - 128-bit entropy + 4-bit checksum = 132 bits = 12 words (11 bits each)
 * - 256-bit entropy + 8-bit checksum = 264 bits = 24 words (11 bits each)
 *
 * The checksum is derived from the SHA256 hash of the entropy, allowing
 * detection of typos and transcription errors.
 *
 * @example
 * ```typescript
 * // Generate 12-word mnemonic (default)
 * const mnemonic12 = generateMnemonic();
 *
 * // Generate 24-word mnemonic
 * const mnemonic24 = generateMnemonic({ strength: 256 });
 *
 * // Generate with custom wordlist
 * const mnemonicES = generateMnemonic({ wordlist: spanishWordlist });
 * ```
 *
 * @see {@link https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki | BIP39: Mnemonic Code}
 */
export interface MnemonicOptions {
  strength?: 128 | 256;
  wordlist?: string[];
}

/**
 * Options for hierarchical deterministic (HD) keypair derivation.
 *
 * @interface DerivationOptions
 * @property {number} [accountIndex=0] - Account index for HD wallet derivation
 *   - Must be a non-negative integer (>= 0)
 *   - Default: 0 (first account)
 *   - Range: 0 to 2^31-1 (2,147,483,647)
 *   - Each index produces a unique, independent keypair
 *   - Same mnemonic + same index = same keypair (deterministic)
 *   - Different indices = different keypairs (cryptographically independent)
 *
 * @remarks
 * Stellar uses the BIP44 HD derivation path: m/44'/148'/accountIndex'
 * - 44' = BIP44 purpose (hardened)
 * - 148' = Stellar coin type (hardened)
 * - accountIndex' = Account index (hardened)
 *
 * The hardened derivation (indicated by ') means that knowledge of a child
 * private key does not compromise the parent or sibling keys.
 *
 * This allows users to:
 * - Manage multiple accounts with a single mnemonic backup
 * - Derive new accounts on-demand without generating new mnemonics
 * - Maintain account independence (compromise of one doesn't affect others)
 *
 * @example
 * ```typescript
 * // Derive first account (default)
 * const account0 = deriveKeypair(mnemonic);
 *
 * // Derive specific account
 * const account5 = deriveKeypair(mnemonic, { accountIndex: 5 });
 *
 * // Derive multiple accounts from same mnemonic
 * const accounts = [0, 1, 2].map(i =>
 *   deriveKeypair(mnemonic, { accountIndex: i })
 * );
 * ```
 *
 * @see {@link https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki | BIP44: Multi-Account Hierarchy}
 * @see {@link https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0005.md | SEP-0005: Key Derivation}
 */
export interface DerivationOptions {
  accountIndex?: number;
}
