import {
  handleResolutionResponseSchema,
  normalizeUsernameHandle,
  type HandleResolver,
  type UsernameHandle,
} from '@ancore/types';

/**
 * Server-side `@username` resolver for the AI agent.
 *
 * Same contract and wire shape as the extension and dashboard resolvers
 * (apps/extension-wallet/src/services/handle-resolver.ts,
 * apps/web-dashboard/src/services/handle-resolver.ts): GET the resolver
 * endpoint, treat 404 as "not found" (`null`), and validate the payload with
 * `handleResolutionResponseSchema` from @ancore/types.
 */

export interface ServiceHandleResolverOptions {
  endpoint?: string;
  fetcher?: typeof fetch;
}

export function createServiceHandleResolver({
  endpoint = process.env['HANDLE_RESOLVER_URL'] ?? '',
  fetcher = fetch,
}: ServiceHandleResolverOptions = {}): HandleResolver {
  return async (handle: UsernameHandle) => {
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

    const parsed = handleResolutionResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return null;
    }

    return parsed.data.status === 'found' ? parsed.data.result : null;
  };
}

/**
 * Default resolver, or `null` when HANDLE_RESOLVER_URL is unset.
 *
 * A service with no resolver configured must reject handles rather than pass
 * them through unresolved — see resolveIntentRecipient() in ./recipients.ts.
 */
export const defaultHandleResolver: HandleResolver | null = process.env['HANDLE_RESOLVER_URL']
  ? createServiceHandleResolver()
  : null;
