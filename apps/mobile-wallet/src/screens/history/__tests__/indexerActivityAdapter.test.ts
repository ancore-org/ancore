/**
 * Unit tests for indexerActivityAdapter.
 */

import { createIndexerActivityAdapter } from '../indexerActivityAdapter';
import type { Transaction } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('createIndexerActivityAdapter', () => {
  const baseUrl = 'http://localhost:3000';
  const accountId = 'GABC123XYZ456DEF789GHI012JKL345MNO678PQR901STU234VWX567YZA';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch first page without cursor', async () => {
    const mockResponse = {
      data: [
        {
          id: '018e1f2a-3b4c-7d8e-9f0a-1b2c3d4e5f6a',
          account_id: accountId,
          activity_type: 'payment',
          amount: '100.0000000',
          asset: 'USDC:GBBD47IF6LWE7PRO46RMRZGUMUAKVO2KXGBR7M2JRM5FUCRA3LVSBYFE',
          counterparty: 'GXYZ987ABC654DEF321GHI098JKL765MNO432PQR109STU876VWX543YZA',
          tx_hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
          ledger_seq: 50123456,
          created_at: '2024-01-15T10:30:00Z',
          metadata: { memo: 'Invoice #1042' },
        },
      ],
      pagination: {
        has_next_page: true,
        has_previous_page: false,
        next_cursor:
          'eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiMDE4ZTFmMmEtM2I0Yy03ZDhlLTlmMGEtMWIyYzNkNGU1ZjZhIn0',
        prev_cursor: null,
        count: 1,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);
    const result = await adapter.fetchTransactionPage({
      cursor: null,
      pageSize: 20,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/accounts/${accountId}/activity?limit=20`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    );

    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      id: '018e1f2a-3b4c-7d8e-9f0a-1b2c3d4e5f6a',
      amount: '100.0000000',
      direction: 'in',
      timestamp: '2024-01-15T10:30:00Z',
      asset: 'USDC:GBBD47IF6LWE7PRO46RMRZGUMUAKVO2KXGBR7M2JRM5FUCRA3LVSBYFE',
      status: 'completed',
    });

    expect(result.nextCursor).toBe(mockResponse.pagination.next_cursor);
  });

  it('should fetch subsequent page with cursor', async () => {
    const cursor =
      'eyJ0IjoiMjAyNC0wMS0xNVQxMDozMDowMFoiLCJpIjoiMDE4ZTFmMmEtM2I0Yy03ZDhlLTlmMGEtMWIyYzNkNGU1ZjZhIn0';
    const mockResponse = {
      data: [
        {
          id: '018e1f2a-3b4c-7d8e-9f0a-1b2c3d4e5f6b',
          account_id: accountId,
          activity_type: 'transfer',
          amount: '50.0000000',
          asset: 'XLM:native',
          counterparty: 'GDEF456ABC789GHI012JKL345MNO678PQR901STU234VWX567YZA890BCD',
          tx_hash: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7',
          ledger_seq: 50123457,
          created_at: '2024-01-15T10:25:00Z',
          metadata: null,
        },
      ],
      pagination: {
        has_next_page: false,
        has_previous_page: true,
        next_cursor: null,
        prev_cursor: cursor,
        count: 1,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);
    const result = await adapter.fetchTransactionPage({
      cursor,
      pageSize: 20,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/accounts/${accountId}/activity?cursor_after=${encodeURIComponent(cursor)}&limit=20`,
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      })
    );

    expect(result.transactions).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('should map outgoing transactions correctly', async () => {
    const mockResponse = {
      data: [
        {
          id: '018e1f2a-3b4c-7d8e-9f0a-1b2c3d4e5f6c',
          account_id: accountId,
          activity_type: 'payment',
          amount: '25.0000000',
          asset: 'USDC:GBBD47IF6LWE7PRO46RMRZGUMUAKVO2KXGBR7M2JRM5FUCRA3LVSBYFE',
          counterparty: accountId, // Same as account_id = outgoing
          tx_hash: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8',
          ledger_seq: 50123458,
          created_at: '2024-01-15T10:20:00Z',
          metadata: null,
        },
      ],
      pagination: {
        has_next_page: false,
        has_previous_page: false,
        next_cursor: null,
        prev_cursor: null,
        count: 1,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);
    const result = await adapter.fetchTransactionPage({
      cursor: null,
      pageSize: 20,
    });

    expect(result.transactions[0].direction).toBe('out');
  });

  it('should handle null amount and asset', async () => {
    const mockResponse = {
      data: [
        {
          id: '018e1f2a-3b4c-7d8e-9f0a-1b2c3d4e5f6d',
          account_id: accountId,
          activity_type: 'contract_invocation',
          amount: null,
          asset: null,
          counterparty: null,
          tx_hash: 'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9',
          ledger_seq: 50123459,
          created_at: '2024-01-15T10:15:00Z',
          metadata: { contract_id: 'CABC123...' },
        },
      ],
      pagination: {
        has_next_page: false,
        has_previous_page: false,
        next_cursor: null,
        prev_cursor: null,
        count: 1,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);
    const result = await adapter.fetchTransactionPage({
      cursor: null,
      pageSize: 20,
    });

    expect(result.transactions[0]).toMatchObject({
      amount: '0',
      asset: undefined,
      status: 'completed',
    });
  });

  it('should throw error on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Database connection failed',
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);

    await expect(adapter.fetchTransactionPage({ cursor: null, pageSize: 20 })).rejects.toThrow(
      'Indexer API error: 500 Internal Server Error - Database connection failed'
    );
  });

  it('should throw error on network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);

    await expect(adapter.fetchTransactionPage({ cursor: null, pageSize: 20 })).rejects.toThrow(
      'Network error'
    );
  });

  it('should pass abort signal to fetch', async () => {
    const mockResponse = {
      data: [],
      pagination: {
        has_next_page: false,
        has_previous_page: false,
        next_cursor: null,
        prev_cursor: null,
        count: 0,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);
    const abortController = new AbortController();

    await adapter.fetchTransactionPage({
      cursor: null,
      pageSize: 20,
      signal: abortController.signal,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: abortController.signal,
      })
    );
  });

  it('should handle empty response', async () => {
    const mockResponse = {
      data: [],
      pagination: {
        has_next_page: false,
        has_previous_page: false,
        next_cursor: null,
        prev_cursor: null,
        count: 0,
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const adapter = createIndexerActivityAdapter(baseUrl, accountId);
    const result = await adapter.fetchTransactionPage({
      cursor: null,
      pageSize: 20,
    });

    expect(result.transactions).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});
