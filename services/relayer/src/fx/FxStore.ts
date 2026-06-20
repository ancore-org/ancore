import { randomUUID } from 'crypto';
import type { ExchangeRate, FxQuote, ConversionRecord } from './types';

export class FxStore {
  private readonly rates = new Map<string, ExchangeRate>();
  private readonly quotes = new Map<string, FxQuote>();
  private readonly conversions: ConversionRecord[] = [];

  // ── Rates ────────────────────────────────────────────────────────────────

  listRates(from?: string, to?: string): ExchangeRate[] {
    const all = [...this.rates.values()].filter((r) => r.active);
    return all.filter((r) => {
      if (from && r.fromAsset !== from) return false;
      if (to && r.toAsset !== to) return false;
      return true;
    });
  }

  getRate(fromAsset: string, toAsset: string): ExchangeRate | undefined {
    for (const rate of this.rates.values()) {
      if (rate.fromAsset === fromAsset && rate.toAsset === toAsset && rate.active) {
        return rate;
      }
    }
    return undefined;
  }

  upsertRate(input: { fromAsset: string; toAsset: string; rate: string }): ExchangeRate {
    const key = this.rateKey(input.fromAsset, input.toAsset);
    const existing = this.rates.get(key);
    const now = new Date().toISOString();

    if (existing) {
      const updated: ExchangeRate = {
        ...existing,
        rate: input.rate,
        active: true,
        updatedAt: now,
      };
      this.rates.set(key, updated);
      return updated;
    }

    const rate: ExchangeRate = {
      id: randomUUID(),
      fromAsset: input.fromAsset,
      toAsset: input.toAsset,
      rate: input.rate,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.rates.set(key, rate);
    return rate;
  }

  deactivateRate(id: string): ExchangeRate | undefined {
    for (const [key, rate] of this.rates.entries()) {
      if (rate.id === id) {
        const updated: ExchangeRate = {
          ...rate,
          active: false,
          updatedAt: new Date().toISOString(),
        };
        this.rates.set(key, updated);
        return updated;
      }
    }
    return undefined;
  }

  // ── Quotes ───────────────────────────────────────────────────────────────

  saveQuote(quote: FxQuote): void {
    this.quotes.set(quote.id, quote);
  }

  getQuote(id: string): FxQuote | undefined {
    return this.quotes.get(id);
  }

  markQuoteUsed(id: string): void {
    const quote = this.quotes.get(id);
    if (quote) {
      this.quotes.set(id, { ...quote, used: true });
    }
  }

  // ── Conversions ──────────────────────────────────────────────────────────

  saveConversion(record: ConversionRecord): void {
    this.conversions.push(record);
  }

  listConversions(
    callerId: string,
    options: { limit: number; cursor?: string; fromDate?: string; toDate?: string }
  ): { data: ConversionRecord[]; nextCursor?: string } {
    let filtered = this.conversions.filter((c) => c.callerId === callerId);

    if (options.fromDate) {
      const from = new Date(options.fromDate).getTime();
      filtered = filtered.filter((c) => new Date(c.createdAt).getTime() >= from);
    }
    if (options.toDate) {
      const to = new Date(options.toDate).getTime();
      filtered = filtered.filter((c) => new Date(c.createdAt).getTime() <= to);
    }

    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (options.cursor) {
      const cursorIdx = filtered.findIndex((c) => c.id === options.cursor);
      if (cursorIdx !== -1) {
        filtered = filtered.slice(cursorIdx + 1);
      }
    }

    const data = filtered.slice(0, options.limit);
    const nextCursor = filtered.length > options.limit ? data[data.length - 1]?.id : undefined;

    return { data, nextCursor };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private rateKey(from: string, to: string): string {
    return `${from}:${to}`;
  }
}
