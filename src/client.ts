import {
  RetryPolicy,
  ExponentialBackoffRetryPolicy,
  RetryOptions,
  defaultRetryOptions,
  executeWithRetry,
} from './retry';

// Assume some base URL and fetch utility for demonstration
const BASE_URL = 'https://api.ancore.org';

interface AncoreClientConfig {
  apiKey?: string;
  retryPolicy?: RetryPolicy | RetryOptions;
}

export class AncoreClient {
  private apiKey?: string;
  private retryPolicy: RetryPolicy;

  constructor(config?: AncoreClientConfig) {
    this.apiKey = config?.apiKey;

    if (config?.retryPolicy instanceof ExponentialBackoffRetryPolicy) {
      this.retryPolicy = config.retryPolicy;
    } else if (config?.retryPolicy) {
      this.retryPolicy = new ExponentialBackoffRetryPolicy(config.retryPolicy);
    } else {
      this.retryPolicy = new ExponentialBackoffRetryPolicy(defaultRetryOptions);
    }
  }

  private async _fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-API-Key': this.apiKey }),
      ...options?.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      // Throw an error with response details for retryCondition to evaluate
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      const error = new Error(`HTTP error! Status: ${response.status}`);
      (error as any).response = response; // Attach response for retry logic
      (error as any).body = errorBody;
      throw error;
    }

    return response.json();
  }

  /**
   * Example method that makes a network call, now with retry logic.
   * @param id The ID of the resource to fetch.
   */
  public async getResource(id: string): Promise<any> {
    return executeWithRetry(() => this._fetch(`/resources/${id}`), this.retryPolicy);
  }

  /**
   * Another example method with retry logic.
   * @param data Data to send.
   */
  public async createResource(data: any): Promise<any> {
    return executeWithRetry(
      () => this._fetch('/resources', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      this.retryPolicy
    );
  }

  // ... other AncoreClient methods would also use executeWithRetry
}
