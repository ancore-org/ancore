import {
  isSmartAccount,
  isSessionKey,
  isValidPermission,
  isInvoice,
  isTransferPolicy,
  isScheduledTransfer,
  isSessionKeyPolicy,
  isStatementRow,
} from '../guards';
import { STATEMENT_STATUSES } from '../statement';

describe('guards', () => {
  test('isSmartAccount returns true for valid object', () => {
    const obj = { publicKey: 'G'.padEnd(56, 'A'), contractId: 'C123', nonce: 1 };
    expect(isSmartAccount(obj)).toBe(true);
  });

  test('isSmartAccount returns false for invalid', () => {
    expect(isSmartAccount(null)).toBe(false);
    expect(isSmartAccount({})).toBe(false);
  });

  test('isSessionKey returns true for valid object', () => {
    const obj = { publicKey: 'G'.padEnd(56, 'A'), permissions: [0], expiresAt: Date.now() };
    expect(isSessionKey(obj)).toBe(true);
  });

  test('isSessionKey returns false for invalid', () => {
    expect(isSessionKey(undefined)).toBe(false);
    expect(isSessionKey({ publicKey: 'G1' })).toBe(false);
  });

  test('isValidPermission recognizes permissions', () => {
    expect(isValidPermission(0)).toBe(true);
    expect(isValidPermission(2)).toBe(true);
    expect(isValidPermission(99)).toBe(false);
    expect(isValidPermission('x')).toBe(false);
  });

  // ── Invoice ─────────────────────────────────────────────────────────────

  test('isInvoice returns true for valid invoice', () => {
    const invoice = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      accountAddress: 'G'.padEnd(56, 'A'),
      recipientAddress: 'G'.padEnd(56, 'B'),
      amount: '100',
      asset: 'XLM',
      status: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };
    expect(isInvoice(invoice)).toBe(true);
  });

  test('isInvoice returns false for invalid invoice', () => {
    expect(isInvoice(null)).toBe(false);
    expect(isInvoice({})).toBe(false);
    expect(isInvoice({ id: 123 })).toBe(false);
  });

  // ── TransferPolicy ──────────────────────────────────────────────────────

  test('isTransferPolicy returns true for valid policy', () => {
    expect(isTransferPolicy({ dailyLimit: 1000, stepUpThreshold: 250 })).toBe(true);
  });

  test('isTransferPolicy returns false for invalid policy', () => {
    expect(isTransferPolicy(null)).toBe(false);
    expect(isTransferPolicy({ dailyLimit: -1, stepUpThreshold: 250 })).toBe(false);
    expect(isTransferPolicy({ dailyLimit: 100 })).toBe(false);
  });

  // ── ScheduledTransfer ───────────────────────────────────────────────────

  test('isScheduledTransfer returns true for valid transfer', () => {
    const transfer = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      accountId: 'G'.padEnd(56, 'A'),
      callerId: 'caller1',
      to: 'G'.padEnd(56, 'B'),
      amount: '50',
      asset: 'XLM',
      frequency: 'daily',
      status: 'active',
      startAt: '2025-06-01T00:00:00Z',
      nextRunAt: '2025-06-02T00:00:00Z',
      userApprovedAt: '2025-05-30T00:00:00Z',
      relayPayload: {
        sessionKey: 'a'.repeat(64),
        operation: 'relay_execute',
        parameters: {},
        signature: 'b'.repeat(128),
        nonce: 0,
      },
      consecutiveFailures: 0,
      createdAt: '2025-05-30T00:00:00Z',
      updatedAt: '2025-05-30T00:00:00Z',
    };
    expect(isScheduledTransfer(transfer)).toBe(true);
  });

  test('isScheduledTransfer returns false for invalid transfer', () => {
    expect(isScheduledTransfer(null)).toBe(false);
    expect(isScheduledTransfer({})).toBe(false);
  });

  // ── SessionKeyPolicy ────────────────────────────────────────────────────

  test('isSessionKeyPolicy returns true for valid policy', () => {
    expect(isSessionKeyPolicy({ expiresAt: Date.now() + 86400000, permissions: 0b111 })).toBe(true);
  });

  test('isSessionKeyPolicy returns false for invalid policy', () => {
    expect(isSessionKeyPolicy(null)).toBe(false);
    expect(isSessionKeyPolicy({ expiresAt: -1, permissions: 0 })).toBe(false);
    expect(isSessionKeyPolicy({ permissions: 0 })).toBe(false);
  });

  // ── StatementRow ────────────────────────────────────────────────────────

  const validStatementRow = {
    id: 'tx1',
    timestamp: '2025-01-01T00:00:00.000Z',
    counterparty: 'GABC',
    amount: '100.0000000',
    asset: 'XLM',
    status: 'completed',
    memoOrReference: 'invoice-42',
  };

  test('isStatementRow returns true for a real StatementRow', () => {
    expect(isStatementRow(validStatementRow)).toBe(true);
  });

  test('isStatementRow accepts every StatementStatus', () => {
    for (const status of STATEMENT_STATUSES) {
      expect(isStatementRow({ ...validStatementRow, status })).toBe(true);
    }
  });

  test('isStatementRow returns false when a required field is missing', () => {
    for (const key of Object.keys(validStatementRow)) {
      const row: Record<string, unknown> = { ...validStatementRow };
      delete row[key];
      expect(isStatementRow(row)).toBe(false);
    }
  });

  test('isStatementRow rejects the legacy date/type shape', () => {
    const legacyRow = {
      id: 'tx1',
      date: '2025-01-01',
      type: 'payment',
      amount: '100',
      asset: 'XLM',
      status: 'completed',
    };
    expect(isStatementRow(legacyRow)).toBe(false);
  });

  test('isStatementRow returns false for invalid values', () => {
    expect(isStatementRow(null)).toBe(false);
    expect(isStatementRow(undefined)).toBe(false);
    expect(isStatementRow({})).toBe(false);
    expect(isStatementRow({ ...validStatementRow, status: 'bogus' })).toBe(false);
    expect(isStatementRow({ ...validStatementRow, amount: 100 })).toBe(false);
  });
});
