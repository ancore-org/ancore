import { Request, Response } from 'express';
import type { RelayServiceContract } from '../types';
import type { RelayExecuteRequest } from '../types';
import { logger, redactRelayRequest } from '../logging';

/**
 * Factory that returns the POST /relay/execute handler bound to a service instance.
 *
 * All log entries redact sensitive fields (sessionKey, signature, signedTransactionXdr)
 * before writing to the log stream. See `src/logging/redact.ts` for the redaction policy.
 */
export function createExecuteRelayHandler(relayService: RelayServiceContract) {
  return async (req: Request, res: Response): Promise<void> => {
    const request = req.body as RelayExecuteRequest;

    logger.info(
      { ...redactRelayRequest(request), handler: 'relay_execute' },
      'relay_execute_received'
    );

    const response = await relayService.executeRelay(request);

    if (response.success) {
      logger.info(
        {
          handler: 'relay_execute',
          transactionId: response.transactionId,
          gasUsed: response.gasUsed,
        },
        'relay_execute_success'
      );
    } else {
      logger.warn(
        {
          handler: 'relay_execute',
          errorCode: response.error?.code,
          errorMessage: response.error?.message,
        },
        'relay_execute_failed'
      );
    }

    res.status(response.success ? 200 : 422).json(response);
  };
}
