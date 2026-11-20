import { Request, Response } from 'express';
import type { RelayServiceContract, RelayExecuteResponse } from '../types';
import type { RelayExecuteRequest } from '../types';
import { RelayErrorCodes } from '../types';
import { redactSessionKey, type Logger } from '../logging';
import type { LoggedRequest } from '../middleware/requestLogger';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';

const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => noopLogger,
};

/**
 * Factory that returns the POST /relay/execute handler bound to a service instance.
 *
 * All log entries redact sensitive fields (sessionKey, signature, signedTransactionXdr)
 * before writing to the log stream. See `src/logging/redact.ts` for the redaction policy.
 */
export function createExecuteRelayHandler(relayService: RelayServiceContract) {
  return async (req: Request, res: Response): Promise<void> => {
    const loggedReq = req as Partial<LoggedRequest>;
    const request = req.body as RelayExecuteRequest;

    const log =
      loggedReq.log?.child({
        route: 'POST /relay/execute',
        sessionKey: redactSessionKey(request.sessionKey),
        operation: request.operation,
      }) ?? noopLogger;

    const start = loggedReq.startTime ?? Date.now();

    let response: RelayExecuteResponse;
    try {
      response = await relayService.executeRelay(request, {
        clientIp: req.ip,
        requestId: req.requestId,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const sanitized = sanitizeErrorMessage(raw);
      if (sanitized === raw) {
        throw err;
      }
      log.error(
        {
          error: raw,
          stack: err instanceof Error ? err.stack : undefined,
          outcome: 'error',
        },
        'internal_storage_error'
      );
      res.locals.relayErrorCode = RelayErrorCodes.INTERNAL_ERROR;
      res.status(500).json({
        success: false,
        error: { code: RelayErrorCodes.INTERNAL_ERROR, message: sanitized },
        gasUsed: 0,
      });
      return;
    }

    if (!response.success && response.error) {
      const sanitized = sanitizeErrorMessage(response.error.message);
      if (sanitized !== response.error.message) {
        log.error({ error: response.error.message, outcome: 'error' }, 'internal_storage_error');
        response = {
          ...response,
          error: { ...response.error, message: sanitized },
        };
      }
    }
    const durationMs = Date.now() - start;

    if (response.success) {
      log.info(
        { durationMs, outcome: 'success', transactionId: response.transactionId },
        'relay_execute_complete'
      );
    } else {
      log.warn(
        {
          durationMs,
          outcome: 'error',
          errorCode: response.error?.code,
          errorMessage: response.error?.message,
        },
        'relay_execute_failed'
      );
      // Expose typed error code to the metrics middleware for relay_errors_total
      if (response.error?.code) {
        res.locals.relayErrorCode = response.error.code;
      }
    }

    res.status(response.success ? 200 : 422).json(response);
  };
}
