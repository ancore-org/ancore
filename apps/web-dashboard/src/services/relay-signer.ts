import type { RelaySigner } from '@ancore/core-sdk';

/**
 * RelaySigner backed by the Ancore extension's real dApp-facing bridge
 * (@ancore/wallet-api's signRelayPayload) — the extension computes its own
 * sessionKey (real public key) and signs the canonical payload internally,
 * so the dashboard never handles raw key material (issue #1213).
 *
 * Uses the account owner's key: true delegated session-key signing isn't
 * available end-to-end yet (the extension's session-key request flow is
 * still an MVP stub that never persists the generated secret), so the owner
 * key is the real signing surface that actually exists today.
 */
export async function createWalletApiRelaySigner(): Promise<RelaySigner> {
  const walletApi = await import('@ancore/wallet-api');

  return {
    async signRelayEnvelope({ operation, nonce }) {
      return walletApi.signRelayPayload({ operation, nonce });
    },
  };
}
