export const STATEMENT_COLUMNS = [
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'counterparty', header: 'Counterparty' },
  { key: 'amount', header: 'Amount' },
  { key: 'asset', header: 'Asset' },
  { key: 'status', header: 'Status' },
  { key: 'memoOrReference', header: 'Memo/Reference' },
] as const;

export type StatementColumnKey = (typeof STATEMENT_COLUMNS)[number]['key'];
export type StatementStatus = 'completed' | 'pending' | 'failed' | 'unknown';
export type StatementExportFormat = 'csv' | 'pdf';

export interface StatementRow {
  id: string;
  timestamp: string;
  counterparty: string;
  amount: string;
  asset: string;
  status: StatementStatus;
  memoOrReference: string;
}

export interface StatementExportFilters {
  accountId: string;
  from: string;
  to: string;
}

export interface StatementRowsPage {
  rows: StatementRow[];
  nextCursor?: string;
}

export interface StatementExportResult {
  filename: string;
  mimeType: string;
  blob: Blob;
}
