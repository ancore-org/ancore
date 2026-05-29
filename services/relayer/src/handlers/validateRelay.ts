import { Request, Response } from 'express';
import type { RelayServiceContract } from '../types';
import type { RelayValidateRequest } from '../types';
import { logger, redactRelayRequest } from '../logging';

/**
 * Factory that returns the POST /relay/validate handler bound to a service instance.
 *
 * All log entries redact sensitive fields (sessionKey, signature) before writing
 * to the log stream. See `src/logging/redact.ts` for the redaction policy.
 */
export function createValidateRelayHandler(relayService: RelayServiceContract) {
  return async (req: Request, res: Response): Promise<void> => {
    const request = req.body as RelayValidateRequest;

    logger.info(
      { ...redactRelayRequest(request), handler: 'relay_validate' },
      'relay_validate_received'
    );

    const result = await relayService.validateRelay(request);

    if (result.valid) {
      logger.info({ handler: 'relay_validate', valid: true }, 'relay_validate_success');
    } else {
      logger.warn(
        {
          handler: 'relay_validate',
          valid: false,
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
        },
        'relay_validate_failed'
      );
    }

    res.status(result.valid ? 200 : 422).json(result);
  };
}
