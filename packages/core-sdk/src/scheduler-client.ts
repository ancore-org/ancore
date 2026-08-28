import type {
  CreateScheduledTransferInput,
  ScheduledTransfer,
  ScheduledTransferExecutionLog,
  ScheduleFrequency,
} from '@ancore/types';

export interface SchedulerClient {
  createScheduledTransfer(input: CreateScheduledTransferInput): Promise<ScheduledTransfer>;
  listScheduledTransfers(accountAddress: string): Promise<ScheduledTransfer[]>;
  getScheduledTransfer(id: string): Promise<ScheduledTransfer>;
  pauseScheduledTransfer(id: string): Promise<ScheduledTransfer>;
  cancelScheduledTransfer(id: string): Promise<ScheduledTransfer>;
  listExecutions(id: string): Promise<ScheduledTransferExecutionLog[]>;
}

export interface SchedulerClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | Promise<string>;
  fetchImpl?: typeof fetch;
}

const DEFAULT_RELAYER_URL = 'http://localhost:3000';
const DEFAULT_AUTH_TOKEN = 'ancore-client-token';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function resolveRelayerBaseUrl(explicit?: string): string {
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  if (typeof process !== 'undefined' && process.env?.VITE_RELAYER_URL) {
    return process.env.VITE_RELAYER_URL.replace(/\/$/, '');
  }

  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    throw new ConfigError('VITE_RELAYER_URL is required in production environment');
  }

  return DEFAULT_RELAYER_URL;
}

export class HttpSchedulerClient implements SchedulerClient {
  private readonly baseUrl: string;
  private readonly getAuthToken: () => string | Promise<string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SchedulerClientOptions = {}) {
    this.baseUrl = resolveRelayerBaseUrl(options.baseUrl);
    this.getAuthToken = options.getAuthToken ?? (() => DEFAULT_AUTH_TOKEN);
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAuthToken();
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = `Scheduler request failed (${response.status})`;
      try {
        const body = (await response.json()) as { message?: string; error?: string };
        message = body.message ?? body.error ?? message;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }

    const body = (await response.json()) as { data: T };
    return body.data;
  }

  createScheduledTransfer(input: CreateScheduledTransferInput): Promise<ScheduledTransfer> {
    return this.request('/api/v1/scheduled-transfers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  listScheduledTransfers(accountAddress: string): Promise<ScheduledTransfer[]> {
    const query = new URLSearchParams({ accountAddress });
    return this.request(`/api/v1/scheduled-transfers?${query.toString()}`);
  }

  getScheduledTransfer(id: string): Promise<ScheduledTransfer> {
    return this.request(`/api/v1/scheduled-transfers/${encodeURIComponent(id)}`);
  }

  pauseScheduledTransfer(id: string): Promise<ScheduledTransfer> {
    return this.request(`/api/v1/scheduled-transfers/${encodeURIComponent(id)}/pause`, {
      method: 'PATCH',
    });
  }

  cancelScheduledTransfer(id: string): Promise<ScheduledTransfer> {
    return this.request(`/api/v1/scheduled-transfers/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
    });
  }

  listExecutions(id: string): Promise<ScheduledTransferExecutionLog[]> {
    return this.request(`/api/v1/scheduled-transfers/${encodeURIComponent(id)}/executions`);
  }
}

let sharedClient: SchedulerClient | null = null;

export function createSchedulerClient(options: SchedulerClientOptions = {}): SchedulerClient {
  return new HttpSchedulerClient(options);
}

export function getSchedulerClient(options: SchedulerClientOptions = {}): SchedulerClient {
  if (options.baseUrl || options.getAuthToken || options.fetchImpl) {
    return createSchedulerClient(options);
  }

  if (!sharedClient) {
    sharedClient = createSchedulerClient();
  }

  return sharedClient;
}

export function resetSchedulerClientForTests(): void {
  sharedClient = null;
}

export function toIsoStartAt(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

export function defaultScheduleStartAt(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date.toISOString().slice(0, 16);
}

export const SCHEDULE_FREQUENCY_OPTIONS: Array<{ value: ScheduleFrequency; label: string }> = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const DEMO_ACCOUNT_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
