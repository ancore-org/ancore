import { describe, expect, it, vi } from 'vitest';
import { STATEMENT_COLUMNS } from '@ancore/types';

import { fetchStatementRows, toStatementCsv } from '../statement-export';

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

    const requestedUrl = new URL(fetcher.mock.calls[0][0]);
    expect(requestedUrl.pathname).toContain(
      '/api/v1/accounts/GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890/statements/rows'
    );
    expect(requestedUrl.searchParams.get('from_date')).toBe('2026-04-01T00:00:00.000Z');
    expect(requestedUrl.searchParams.get('to_date')).toBe('2026-04-30T23:59:59.999Z');
    expect(requestedUrl.searchParams.get('limit')).toBe('100');
    expect(rows[0]).toMatchObject(row);
  });
});
