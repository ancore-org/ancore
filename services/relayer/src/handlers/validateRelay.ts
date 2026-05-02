import { Request, Response } from 'express';
import type { RelayServiceContract } from '../types';
import type { RelayValidateRequest } from '../types';

/**
 * Factory that returns the POST /relay/validate handler bound to a service instance.
 */
export function createValidateRelayHandler(relayService: RelayServiceContract) {
  return async (req: Request, res: Response): Promise<void> => {
    const request = req.body as RelayValidateRequest;
    const result = await relayService.validateRelay(request);
    res.status(result.valid ? 200 : 422).json(result);
  };
}
