/**
 * Password validation and key derivation module
 *
 * This module provides password strength validation using zxcvbn and secure
 * key derivation using PBKDF2-SHA256. It also includes utilities for generating
 * cryptographically secure random salts.
 *
 * @module password
 */

import zxcvbn from 'zxcvbn';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import type { PasswordStrength } from './types';
import * as crypto from 'node:crypto';

/**
 * Minimum PBKDF2 iterations (OWASP 2023 recommendation)
 */
const MIN_ITERATIONS = 100000;

/**
 * Minimum password strength score for validity
 */
const MIN_VALID_SCORE = 3;

/**
 * Salt size in bytes (256 bits)
 */
const SALT_SIZE = 32;

/**
 * Derived key size in bytes (256 bits)
 */
const KEY_SIZE = 32;

/**
 * Validates password strength using the zxcvbn algorithm.
 *
 * @param password - The password to validate
 * @returns PasswordStrength object with score (0-4), feedback, and validity
 *
 * @remarks
 * - Score 0-2: Weak password (isValid = false)
 * - Score 3-4: Strong password (isValid = true)
 * - Empty passwords return score 0
 * - Feedback provides actionable suggestions for weak passwords
 *
 * @example
 * ```typescript
 * const strength = validatePassword("MyP@ssw0rd123");
 * if (!strength.isValid) {
 *   console.log("Weak password:", strength.feedback);
 * }
 * ```
 */
export function validatePassword(password: string): PasswordStrength {
  // Handle empty password
  if (!password || password.length === 0) {
    return {
      score: 0,
      feedback: ['Password cannot be empty'],
      isValid: false,
    };
  }

  // Use zxcvbn for strength analysis
  const result = zxcvbn(password);

  // Extract feedback suggestions
  const feedback: string[] = [];

  if (result.feedback.warning) {
    feedback.push(result.feedback.warning);
  }

  if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
    feedback.push(...result.feedback.suggestions);
  }

  return {
    score: result.score,
    feedback,
    isValid: result.score >= MIN_VALID_SCORE,
  };
}

/**
 * Generates a cryptographically secure random salt.
 *
 * @returns 32-byte Uint8Array containing random data
 *
 * @remarks
 * Uses crypto.getRandomValues() for secure randomness.
 * Each salt is unique and unpredictable.
 *
 * @example
 * ```typescript
 * const salt = generateSalt();
 * console.log(salt.length); // 32
 * ```
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_SIZE);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Derives a 256-bit encryption key from a password using PBKDF2-SHA256.
 *
 * @param password - The password to derive the key from
 * @param salt - 32-byte salt for key derivation
 * @param iterations - Number of PBKDF2 iterations (default: 100,000)
 * @returns Promise resolving to 32-byte derived key
 *
 * @throws {Error} If salt is not 32 bytes
 * @throws {Error} If iterations is less than 100,000
 *
 * @remarks
 * - Uses PBKDF2-SHA256 with configurable iterations
 * - Minimum 100,000 iterations (OWASP recommendation)
 * - Same password + salt + iterations always produces same key (deterministic)
 * - Different salts produce cryptographically independent keys
 * - Computation is intentionally slow to resist brute force attacks
 *
 * @example
 * ```typescript
 * const salt = generateSalt();
 * const key = await deriveEncryptionKey("MyP@ssw0rd", salt);
 * console.log(key.length); // 32
 * ```
 */
export async function deriveEncryptionKey(
  password: string,
  salt: Uint8Array,
  iterations: number = MIN_ITERATIONS
): Promise<Uint8Array> {
  // Validate inputs
  if (salt.length !== SALT_SIZE) {
    throw new Error(`Salt must be exactly ${SALT_SIZE} bytes, got ${salt.length}`);
  }

  if (iterations < MIN_ITERATIONS) {
    throw new Error(`Iterations must be at least ${MIN_ITERATIONS}, got ${iterations}`);
  }

  // Convert password to bytes
  const passwordBytes = new TextEncoder().encode(password);

  // Derive key using PBKDF2-SHA256
  const derivedKey = pbkdf2(sha256, passwordBytes, salt, {
    c: iterations,
    dkLen: KEY_SIZE,
  });

  return derivedKey;
}
