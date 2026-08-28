import {
  handleResolutionResponseSchema,
  normalizeUsernameHandle,
  type HandleResolver,
} from '@ancore/types';

export interface EndpointHandleResolverOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
}

export function createEndpointHandleResolver({
  endpoint = '/api/handles/resolve',
  fetcher = fetch,
}: EndpointHandleResolverOptions = {}): HandleResolver {
  return async (handle) => {
    const normalized = normalizeUsernameHandle(handle);
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await fetcher(
      `${endpoint}${separator}handle=${encodeURIComponent(normalized)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Unable to resolve handle');
    }

    const payload = await response.json();
    const parsed = handleResolutionResponseSchema.safeParse(payload);

    if (parsed.success) {
      return parsed.data.status === 'found' ? parsed.data.result : null;
    }

    return payload?.accountAddress ? { handle: normalized, ...payload } : null;
  };
}

export const resolveHandle = createEndpointHandleResolver();
