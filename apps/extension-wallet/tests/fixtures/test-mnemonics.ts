/**
 * Dedicated test recovery phrases — NEVER use these on mainnet.
 * Each phrase funds only testnet accounts via Friendbot.
 *
 * ALPHA  — used for onboarding and lock/unlock flows
 * BRAVO  — used as a send/receive counterparty
 * CHARLIE — used for allowlist / grant-access flows
 */
export const TEST_MNEMONICS = {
  ALPHA: [
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'about',
  ].join(' '),

  BRAVO: [
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'abandon',
    'zoo',
  ].join(' '),

  CHARLIE: [
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'zoo',
    'wrong',
  ].join(' '),
} as const;

export type TestMnemonicKey = keyof typeof TEST_MNEMONICS;

/** Password used across all e2e test wallets. */
export const TEST_PASSWORD = 'TestPassword123!';
