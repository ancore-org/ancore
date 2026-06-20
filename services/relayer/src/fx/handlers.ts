import { Request, Response } from 'express';
import { FxService, FxError } from './FxService';
import {
  listRatesQuerySchema,
  createQuoteSchema,
  executeConversionSchema,
  listHistoryQuerySchema,
  createExchangeRateSchema,
} from './schemas';

function getCallerId(res: Response): string {
  return res.locals['callerId'] as string;
}

function sendFxError(res: Response, err: FxError): void {
  const status = err.code === 'RATE_NOT_FOUND' ? 404 : 422;
  res.status(status).json({ error: err.code, message: err.message });
}

export function createListRatesHandler(service: FxService) {
  return (req: Request, res: Response): void => {
    const query = listRatesQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid query parameters' });
      return;
    }

    const rates = service.listRates(query.data.from, query.data.to);
    res.status(200).json({ data: rates });
  };
}

export function createQuoteHandler(service: FxService) {
  return (req: Request, res: Response): void => {
    const parsed = createQuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request body' });
      return;
    }

    try {
      const quote = service.createQuote(parsed.data);
      res.status(201).json({ data: quote });
    } catch (err) {
      if (err instanceof FxError) {
        sendFxError(res, err);
        return;
      }
      throw err;
    }
  };
}

export function createConvertHandler(service: FxService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const parsed = executeConversionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request body' });
      return;
    }

    try {
      const record = service.executeConversion(parsed.data.quoteId, parsed.data.walletId, callerId);
      res.status(200).json({ data: record });
    } catch (err) {
      if (err instanceof FxError) {
        sendFxError(res, err);
        return;
      }
      throw err;
    }
  };
}

export function createListHistoryHandler(service: FxService) {
  return (req: Request, res: Response): void => {
    const callerId = getCallerId(res);
    const query = listHistoryQuerySchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid query parameters' });
      return;
    }

    const result = service.listHistory(callerId, query.data);
    res.status(200).json({ data: result.data, nextCursor: result.nextCursor });
  };
}

export function createUpsertRateHandler(service: FxService) {
  return (req: Request, res: Response): void => {
    const parsed = createExchangeRateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid request body' });
      return;
    }

    const rate = service.createRate(parsed.data);
    res.status(200).json({ data: rate });
  };
}

export function createDeactivateRateHandler(service: FxService) {
  return (req: Request, res: Response): void => {
    const id = req.params['id'] ?? '';
    if (!id) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Rate ID is required' });
      return;
    }

    try {
      const rate = service.deactivateRate(id);
      res.status(200).json({ data: rate });
    } catch (err) {
      if (err instanceof FxError) {
        sendFxError(res, err);
        return;
      }
      throw err;
    }
  };
}
