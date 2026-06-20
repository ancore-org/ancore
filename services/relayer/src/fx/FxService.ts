import { randomUUID } from 'crypto';
import { FxStore } from './FxStore';
import type {
  ExchangeRate,
  FxQuote,
  ConversionRecord,
  CreateExchangeRateInput,
  CreateQuoteInput,
} from './types';

const DEFAULT_QUOTE_TTL_MS = 30_000;

export class FxService {
  constructor(
    private readonly store: FxStore,
    private readonly quoteTtlMs: number = DEFAULT_QUOTE_TTL_MS
  ) {}

  listRates(from?: string, to?: string): ExchangeRate[] {
    return this.store.listRates(from, to);
  }

  createQuote(input: CreateQuoteInput): FxQuote {
    const { fromAsset, toAsset, amount } = input;
    const rate = this.store.getRate(fromAsset, toAsset);
    if (!rate) {
      throw new FxError(`No active rate found for ${fromAsset} → ${toAsset}`, 'RATE_NOT_FOUND');
    }

    const numericAmount = parseFloat(amount);
    const numericRate = parseFloat(rate.rate);
    const convertedAmount = (numericAmount * numericRate).toFixed(7);

    const quote: FxQuote = {
      id: randomUUID(),
      fromAsset,
      toAsset,
      amount,
      convertedAmount,
      rate: rate.rate,
      expiresAt: new Date(Date.now() + this.quoteTtlMs).toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    };

    this.store.saveQuote(quote);
    return quote;
  }

  executeConversion(quoteId: string, walletId: string, callerId: string): ConversionRecord {
    const quote = this.store.getQuote(quoteId);
    if (!quote) {
      throw new FxError('Quote not found', 'QUOTE_NOT_FOUND');
    }
    if (quote.used) {
      throw new FxError('Quote has already been used', 'QUOTE_USED');
    }
    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      throw new FxError('Quote has expired', 'QUOTE_EXPIRED');
    }

    this.store.markQuoteUsed(quoteId);

    const record: ConversionRecord = {
      id: randomUUID(),
      quoteId,
      walletId,
      callerId,
      fromAsset: quote.fromAsset,
      toAsset: quote.toAsset,
      amount: quote.amount,
      convertedAmount: quote.convertedAmount,
      rate: quote.rate,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };

    this.store.saveConversion(record);
    return record;
  }

  listHistory(
    callerId: string,
    options: { limit: number; cursor?: string; fromDate?: string; toDate?: string }
  ): { data: ConversionRecord[]; nextCursor?: string } {
    return this.store.listConversions(callerId, options);
  }

  createRate(input: CreateExchangeRateInput): ExchangeRate {
    return this.store.upsertRate(input);
  }

  deactivateRate(id: string): ExchangeRate {
    const rate = this.store.deactivateRate(id);
    if (!rate) {
      throw new FxError('Exchange rate not found', 'RATE_NOT_FOUND');
    }
    return rate;
  }
}

export class FxError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'FxError';
  }
}
