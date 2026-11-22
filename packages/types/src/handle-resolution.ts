import { z } from 'zod';

/** Canonical @username handle accepted by Ancore send flows. */
export type UsernameHandle = string & { readonly __brand: 'UsernameHandle' };

/** Minimum portable username rules shared by clients and resolver services. */
export const usernameHandleSchema = z
  .string()
  .trim()
  .regex(/^@?[a-zA-Z0-9][a-zA-Z0-9_.-]{0,30}$/, {
    message: 'Enter a valid @username handle',
  });

/** Request contract for an off-chain handle resolver endpoint. */
export const handleResolutionRequestSchema = z.object({
  handle: usernameHandleSchema,
});

/** Successful resolver payload. */
export const resolvedHandleSchema = z.object({
  handle: usernameHandleSchema,
  accountAddress: z
    .string()
    .regex(/^(G|C)[A-Z0-9]{55}$/, 'Must be a valid Stellar address (G... or C...)'),
  displayName: z.string().optional(),
});

/** Resolver response contract for found and not-found states. */
export const handleResolutionResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('found'),
    result: resolvedHandleSchema,
  }),
  z.object({
    status: z.literal('not_found'),
    error: z.string().default('Handle not found'),
  }),
]);

export type HandleResolutionRequest = z.infer<typeof handleResolutionRequestSchema>;
export type ResolvedHandle = z.infer<typeof resolvedHandleSchema>;
export type HandleResolutionResponse = z.infer<typeof handleResolutionResponseSchema>;
export type HandleResolver = (handle: UsernameHandle) => Promise<ResolvedHandle | null>;

export function isUsernameHandle(value: string): value is UsernameHandle {
  return usernameHandleSchema.safeParse(value).success;
}

/**
 * Validate an untrusted handle and return it with the UsernameHandle brand.
 * Throws a descriptive error instead of allowing invalid input to be branded.
 */
export function validateUsernameHandle(value: string): UsernameHandle {
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  const result = usernameHandleSchema.safeParse(normalized);
  if (!result.success) {
    const detail = result.error.issues[0]?.message ?? 'Invalid username handle';
    throw new Error(`Invalid username handle "${value}": ${detail}`);
  }
  return result.data.replace(/^@/, '') as UsernameHandle;
}

/**
 * Trim and lowercase a handle.
 *
 * The overloads keep the brand sound: a caller that already holds a
 * `UsernameHandle` gets a non-null `UsernameHandle` back, while raw `string`
 * input is re-validated and throws a descriptive error when it is not a
 * valid handle. No unchecked cast escapes without runtime validation.
 */
export function normalizeUsernameHandle(value: UsernameHandle): UsernameHandle;
// eslint-disable-next-line no-redeclare -- TypeScript overload signature, not a redeclaration
export function normalizeUsernameHandle(value: string): UsernameHandle;
// eslint-disable-next-line no-redeclare -- implementation signature for the overloads above
export function normalizeUsernameHandle(value: string): UsernameHandle {
  const normalized = value.trim().replace(/^@/, '').toLowerCase();
  return validateUsernameHandle(normalized);
}
