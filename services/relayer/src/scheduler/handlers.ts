import { NextFunction, Request, Response } from 'express';
import type { ScheduledTransferService } from './ScheduledTransferService';

function getCallerId(res: Response): string {
  return res.locals['callerId'] as string;
}

export function createScheduledTransferHandler(service: ScheduledTransferService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = getCallerId(res);
      const transfer = await service.create(req.body, callerId);
      res.status(201).json({ data: transfer });
    } catch (err) {
      next(err);
    }
  };
}

export function createListScheduledTransfersHandler(service: ScheduledTransferService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = getCallerId(res);
      const accountAddress = req.query['accountAddress'];

      if (typeof accountAddress !== 'string') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'accountAddress query parameter is required',
        });
        return;
      }

      const transfers = await service.list(accountAddress, callerId);
      res.status(200).json({ data: transfers });
    } catch (err) {
      next(err);
    }
  };
}

export function createGetScheduledTransferHandler(service: ScheduledTransferService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = getCallerId(res);
      const transfer = await service.get(req.params['id'] ?? '', callerId);

      if (!transfer) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Scheduled transfer not found' });
        return;
      }

      res.status(200).json({ data: transfer });
    } catch (err) {
      next(err);
    }
  };
}

export function createPauseScheduledTransferHandler(service: ScheduledTransferService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = getCallerId(res);
      const transfer = await service.pause(req.params['id'] ?? '', callerId);

      if (!transfer) {
        res.status(422).json({
          error: 'INVALID_STATE',
          message: 'Scheduled transfer cannot be paused',
        });
        return;
      }

      res.status(200).json({ data: transfer });
    } catch (err) {
      next(err);
    }
  };
}

export function createCancelScheduledTransferHandler(service: ScheduledTransferService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = getCallerId(res);
      const transfer = await service.cancel(req.params['id'] ?? '', callerId);

      if (!transfer) {
        res.status(422).json({
          error: 'INVALID_STATE',
          message: 'Scheduled transfer cannot be cancelled',
        });
        return;
      }

      res.status(200).json({ data: transfer });
    } catch (err) {
      next(err);
    }
  };
}

export function createListExecutionsHandler(service: ScheduledTransferService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const callerId = getCallerId(res);
      const transfer = await service.get(req.params['id'] ?? '', callerId);

      if (!transfer) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'Scheduled transfer not found' });
        return;
      }

      const executions = await service.listExecutions(transfer.id, callerId);
      res.status(200).json({ data: executions });
    } catch (err) {
      next(err);
    }
  };
}
