import { Request, Response } from 'express';
import type { RelayServiceContract } from '../types';
import type { RelayExecuteRequest } from '../types';

/**
 * Factory that returns the POST /relay/execute handler bound to a service instance.
 */
export function createExecuteRelayHandler(relayService: RelayServiceContract) {
  return async (req: Request, res: Response): Promise<void> => {
    const request = req.body as RelayExecuteRequest;
    const response = await relayService.executeRelay(request);
    res.status(response.success ? 200 : 422).json(response);
  };
}
