import { Request, Response } from 'express';
import type { ScheduledTransferService } from './ScheduledTransferService';

function getCallerId(res: Response): string {
  return res.locals['callerId'] as string;
}

export function createScheduledTransferHandler(service: ScheduledTransferService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const transfer = service.create(req.body, callerId);
    res.status(201).json({ data: transfer });
  };
}

export function createListScheduledTransfersHandler(service: ScheduledTransferService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const accountAddress = req.query['accountAddress'];

    if (typeof accountAddress !== 'string') {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'accountAddress query parameter is required',
      });
      return;
    }

    const transfers = service.list(accountAddress, callerId);
    res.status(200).json({ data: transfers });
  };
}

export function createGetScheduledTransferHandler(service: ScheduledTransferService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const transfer = service.get(req.params['id'] ?? '', callerId);

    if (!transfer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Scheduled transfer not found' });
      return;
    }

    res.status(200).json({ data: transfer });
  };
}

export function createPauseScheduledTransferHandler(service: ScheduledTransferService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const transfer = service.pause(req.params['id'] ?? '', callerId);

    if (!transfer) {
      res.status(422).json({
        error: 'INVALID_STATE',
        message: 'Scheduled transfer cannot be paused',
      });
      return;
    }

    res.status(200).json({ data: transfer });
  };
}

export function createCancelScheduledTransferHandler(service: ScheduledTransferService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const transfer = service.cancel(req.params['id'] ?? '', callerId);

    if (!transfer) {
      res.status(422).json({
        error: 'INVALID_STATE',
        message: 'Scheduled transfer cannot be cancelled',
      });
      return;
    }

    res.status(200).json({ data: transfer });
  };
}

export function createListExecutionsHandler(service: ScheduledTransferService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const transfer = service.get(req.params['id'] ?? '', callerId);

    if (!transfer) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Scheduled transfer not found' });
      return;
    }

    const executions = service.listExecutions(transfer.id, callerId);
    res.status(200).json({ data: executions });
  };
}
