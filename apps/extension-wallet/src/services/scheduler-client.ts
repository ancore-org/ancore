import {
  buildDefaultRelayPayload,
  createSchedulerClient,
  getSchedulerClient,
  defaultScheduleStartAt,
  DEMO_ACCOUNT_ADDRESS,
  resetSchedulerClientForTests,
  resolveRelayerBaseUrl,
  SCHEDULE_FREQUENCY_OPTIONS,
  toIsoStartAt,
  type SchedulerClient,
  type SchedulerClientOptions,
} from '@ancore/core-sdk';

const EXTENSION_AUTH_TOKEN_KEY = 'ancore_extension_access_token';
const DEFAULT_RELAYER_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_RELAYER_URL
    ? import.meta.env.VITE_RELAYER_URL
    : 'http://localhost:3000';

export function getExtensionSchedulerClient() {
  return getSchedulerClient({
    baseUrl: DEFAULT_RELAYER_URL,
    getAuthToken: () => {
      if (typeof window === 'undefined') {
        return 'ancore-client-token';
      }
      return window.localStorage.getItem(EXTENSION_AUTH_TOKEN_KEY) ?? 'ancore-client-token';
    },
  });
}
