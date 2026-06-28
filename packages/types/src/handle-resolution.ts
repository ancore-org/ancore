import { z } from 'zod';

/** Canonical @username handle accepted by Ancore send flows. */
export type UsernameHandle = `@${string}`;

/** Minimum portable username rules shared by clients and resolver services. */
export const usernameHandleSchema = z
  .string()
  .trim()
  .regex(/^@[a-zA-Z0-9][a-zA-Z0-9_.-]{0,30}$/, {
    message: 'Enter a valid @username handle',
  });

/** Request contract for an off-chain handle resolver endpoint. */
export const handleResolutionRequestSchema = z.object({
  handle: usernameHandleSchema,
});

/** Successful resolver payload. */
export const resolvedHandleSchema = z.object({
  handle: usernameHandleSchema,
  accountAddress: z.string().regex(/^G[A-Z0-9]{55}$/, 'Must be a valid Stellar address (G...)'),
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

export function normalizeUsernameHandle(value: string): UsernameHandle {
  return value.trim().toLowerCase() as UsernameHandle;
}
