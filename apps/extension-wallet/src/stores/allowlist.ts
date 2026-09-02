import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { NETWORK_PASSPHRASES } from '@ancore/wallet-shared';
import { extensionStorage } from './_storage';

export interface ConnectedSiteRecord {
  origin: string;
  accountId: string;
  network: string;
  connectedAt: number;
}

export interface AllowlistState {
  approvedSites: Record<string, Record<string, string[]>>;
  connectedSites: Record<string, Record<string, Record<string, ConnectedSiteRecord>>>;
  isApproved: (origin: string, accountId: string, network: string) => boolean;
  approve: (origin: string, accountId: string, network: string) => void;
  revoke: (origin: string, accountId: string, network: string) => void;
  revokeAll: (accountId: string, network: string) => void;
  getApprovedList: (accountId: string, network: string) => string[];
  getConnectedSites: (accountId: string, network: string) => ConnectedSiteRecord[];
}

// ---------------------------------------------------------------------------
// Rehydration hardening
//
// chrome.storage.local is outside our control (extension updates, manual
// edits via devtools, storage corruption) — validate its shape before it
// becomes live state instead of trusting it. Mirrors the validation that
// @ancore/wallet-shared's (now-removed, unused) allowlist module applied to
// its flat AllowlistEntry[] shape, adapted to this store's nested
// Record<accountId, Record<network, ...>> shape.
// ---------------------------------------------------------------------------

const KNOWN_NETWORKS: readonly string[] = Object.keys(NETWORK_PASSPHRASES);

/** Soroban contract C-address: 'C' followed by 55 base32 characters. */
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;

function isValidAccountId(value: unknown): value is string {
  return typeof value === 'string' && CONTRACT_ID_PATTERN.test(value);
}

function isValidNetwork(value: unknown): value is string {
  return typeof value === 'string' && KNOWN_NETWORKS.includes(value);
}

/** Accepts only absolute http(s) URLs reduced to their origin — no path, query, or credentials. */
function isValidOrigin(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  return parsed.origin === value;
}

function isValidConnectedAt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function sanitizeApprovedSites(raw: unknown): AllowlistState['approvedSites'] {
  const result: AllowlistState['approvedSites'] = {};
  if (!raw || typeof raw !== 'object') return result;

  for (const [accountId, byNetwork] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidAccountId(accountId) || !byNetwork || typeof byNetwork !== 'object') continue;

    for (const [network, origins] of Object.entries(byNetwork as Record<string, unknown>)) {
      if (!isValidNetwork(network) || !Array.isArray(origins)) continue;
      const validOrigins = origins.filter(isValidOrigin);
      if (validOrigins.length === 0) continue;
      result[accountId] ??= {};
      result[accountId][network] = validOrigins;
    }
  }

  return result;
}

function sanitizeConnectedSites(raw: unknown): AllowlistState['connectedSites'] {
  const result: AllowlistState['connectedSites'] = {};
  if (!raw || typeof raw !== 'object') return result;

  for (const [accountId, byNetwork] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidAccountId(accountId) || !byNetwork || typeof byNetwork !== 'object') continue;

    for (const [network, byOrigin] of Object.entries(byNetwork as Record<string, unknown>)) {
      if (!isValidNetwork(network) || !byOrigin || typeof byOrigin !== 'object') continue;

      for (const [origin, record] of Object.entries(byOrigin as Record<string, unknown>)) {
        if (!isValidOrigin(origin) || !record || typeof record !== 'object') continue;
        const r = record as Partial<ConnectedSiteRecord>;
        if (
          r.origin !== origin ||
          r.accountId !== accountId ||
          r.network !== network ||
          !isValidConnectedAt(r.connectedAt)
        ) {
          continue;
        }

        result[accountId] ??= {};
        result[accountId][network] ??= {};
        result[accountId][network][origin] = { origin, accountId, network, connectedAt: r.connectedAt };
      }
    }
  }

  return result;
}

export const useAllowlistStore = create<AllowlistState>()(
  persist(
    (set, get) => ({
      approvedSites: {},
      connectedSites: {},
      isApproved: (origin: string, accountId: string, network: string) => {
        const { approvedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        const networkSites = accountSites[network] || [];
        return networkSites.includes(origin);
      },
      approve: (origin: string, accountId: string, network: string) => {
        set((state) => {
          const accountSites = state.approvedSites[accountId] || {};
          const networkSites = accountSites[network] || [];
          if (networkSites.includes(origin)) return state;

          const accountConnectedSites = state.connectedSites[accountId] || {};
          const networkConnectedSites = accountConnectedSites[network] || {};

          return {
            approvedSites: {
              ...state.approvedSites,
              [accountId]: {
                ...accountSites,
                [network]: [...networkSites, origin],
              },
            },
            connectedSites: {
              ...state.connectedSites,
              [accountId]: {
                ...accountConnectedSites,
                [network]: {
                  ...networkConnectedSites,
                  [origin]: {
                    origin,
                    accountId,
                    network,
                    connectedAt: Date.now(),
                  },
                },
              },
            },
          };
        });
      },
      revoke: (origin: string, accountId: string, network: string) => {
        set((state) => {
          const accountSites = state.approvedSites[accountId] || {};
          const networkSites = accountSites[network] || [];
          if (!networkSites.includes(origin)) return state;

          const nextApprovedSites = {
            ...state.approvedSites,
            [accountId]: {
              ...accountSites,
              [network]: networkSites.filter((site) => site !== origin),
            },
          };

          const nextConnectedSites = { ...state.connectedSites };
          const accountConnectedSites = nextConnectedSites[accountId] || {};
          const networkConnectedSites = accountConnectedSites[network] || {};
          const nextNetworkConnectedSites = { ...networkConnectedSites };
          delete nextNetworkConnectedSites[origin];

          if (Object.keys(nextNetworkConnectedSites).length === 0) {
            delete nextConnectedSites[accountId]?.[network];
          } else {
            nextConnectedSites[accountId] = {
              ...accountConnectedSites,
              [network]: nextNetworkConnectedSites,
            };
          }

          return {
            approvedSites: nextApprovedSites,
            connectedSites: nextConnectedSites,
          };
        });
      },
      revokeAll: (accountId: string, network: string) => {
        set((state) => {
          const accountSites = state.approvedSites[accountId] || {};
          if (!(network in accountSites)) return state;

          const nextApprovedSites = { ...state.approvedSites };
          const accountApprovedSites = { ...accountSites };
          delete accountApprovedSites[network];
          nextApprovedSites[accountId] = accountApprovedSites;

          const nextConnectedSites = { ...state.connectedSites };
          const accountConnectedSites = { ...(nextConnectedSites[accountId] || {}) };
          delete accountConnectedSites[network];
          if (Object.keys(accountConnectedSites).length === 0) {
            delete nextConnectedSites[accountId];
          } else {
            nextConnectedSites[accountId] = accountConnectedSites;
          }

          return {
            approvedSites: nextApprovedSites,
            connectedSites: nextConnectedSites,
          };
        });
      },
      getApprovedList: (accountId: string, network: string) => {
        const { approvedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        return accountSites[network] || [];
      },
      getConnectedSites: (accountId: string, network: string) => {
        const { approvedSites, connectedSites } = get();
        const accountSites = approvedSites[accountId] || {};
        const networkSites = accountSites[network] || [];
        const metadataEntries = connectedSites[accountId]?.[network] || {};

        return networkSites
          .map((origin) => {
            const existingRecord = metadataEntries[origin];
            if (existingRecord) return existingRecord;
            return {
              origin,
              accountId,
              network,
              connectedAt: Date.now(),
            };
          })
          .sort((left, right) => left.origin.localeCompare(right.origin));
      },
    }),
    {
      name: 'ancore_allowlist',
      storage: createJSONStorage(() => extensionStorage),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<AllowlistState>;
        return {
          ...currentState,
          approvedSites: sanitizeApprovedSites(persisted.approvedSites),
          connectedSites: sanitizeConnectedSites(persisted.connectedSites),
        };
      },
    }
  )
);
