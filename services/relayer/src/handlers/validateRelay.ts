import { Request, Response } from 'express';
import type { RelayServiceContract } from '../types';
import type { RelayValidateRequest } from '../types';
import { redactSessionKey } from '../logging';

/**
 * Factory that returns the POST /relay/validate handler bound to a service instance.
 *
 * All log entries redact sensitive fields (sessionKey, signature) before writing
 * to the log stream. See `src/logging/redact.ts` for the redaction policy.
 */
export function createValidateRelayHandler(relayService: RelayServiceContract) {
  return async (req: Request, res: Response): Promise<void> => {
    const request = req.body as RelayValidateRequest;

    const log = req.log?.child({
      route: 'POST /relay/validate',
      sessionKey: redactSessionKey(request.sessionKey),
      operation: request.operation,
    }) ?? { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => ({} as any) };

    const start = req.startTime ?? Date.now();

    const result = await relayService.validateRelay(request);
    const durationMs = Date.now() - start;

    if (result.valid) {
      log.info({ durationMs, outcome: 'success' }, 'relay_validate_complete');
    } else {
      log.warn(
        {
          durationMs,
          outcome: 'validation_failed',
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
        },
        'relay_validate_failed'
      );
    }

    res.status(result.valid ? 200 : 422).json(result);
  };
}
