import {
  STATEMENT_COLUMNS,
  type StatementExportFilters,
  type StatementExportFormat,
  type StatementExportResult,
  type StatementRow,
  type StatementRowsPage,
} from '@ancore/types';

const DEFAULT_PAGE_LIMIT = 100;
const MAX_EXPORT_ROWS = 5_000;
const INDEXER_BASE_URL = import.meta.env.VITE_INDEXER_BASE_URL ?? '';

interface IndexerStatementRow {
  id: string;
  timestamp: string;
  counterparty?: string | null;
  amount?: string | null;
  asset?: string | null;
  status?: string | null;
  memo_or_reference?: string | null;
  memoOrReference?: string | null;
}

interface IndexerStatementRowsResponse {
  rows: IndexerStatementRow[];
  next_cursor?: string | null;
}

export class StatementExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StatementExportError';
  }
}

function assertFilters(filters: StatementExportFilters) {
  if (!filters.accountId.trim()) {
    throw new StatementExportError('Choose an account before exporting a statement.');
  }

  const fromTime = Date.parse(filters.from);
  const toTime = Date.parse(filters.to);
  if (Number.isNaN(fromTime) || Number.isNaN(toTime)) {
    throw new StatementExportError('Choose a valid statement date range.');
  }
  if (fromTime > toTime) {
    throw new StatementExportError('Statement start date must be before the end date.');
  }
}

function normalizeStatus(value: string | undefined): StatementRow['status'] {
  if (value === 'completed' || value === 'pending' || value === 'failed') {
    return value;
  }
  return 'unknown';
}

function indexerRowToStatementRow(row: IndexerStatementRow): StatementRow {
  return {
    id: row.id,
    timestamp: row.timestamp,
    counterparty: row.counterparty ?? '—',
    amount: row.amount ?? '0',
    asset: row.asset ?? 'XLM',
    status: normalizeStatus(row.status ?? undefined),
    memoOrReference: row.memoOrReference ?? row.memo_or_reference ?? '',
  };
}

function buildStatementRowsUrl(filters: StatementExportFilters, cursor?: string): string {
  const url = new URL(
    `/api/v1/accounts/${encodeURIComponent(filters.accountId)}/statements/rows`,
    INDEXER_BASE_URL || window.location.origin
  );
  url.searchParams.set('from_date', new Date(filters.from).toISOString());
  url.searchParams.set('to_date', new Date(filters.to).toISOString());
  url.searchParams.set('limit', String(DEFAULT_PAGE_LIMIT));
  if (cursor) {
    url.searchParams.set('cursor_after', cursor);
  }
  return url.toString();
}

function escapeCsvCell(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toStatementCsv(rows: StatementRow[]): string {
  const header = STATEMENT_COLUMNS.map((column) => escapeCsvCell(column.header)).join(',');
  const body = rows.map((row) =>
    STATEMENT_COLUMNS.map((column) => escapeCsvCell(String(row[column.key]))).join(',')
  );
  return [header, ...body].join('\n');
}

function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, '\\$1').replace(/[\n\r]/g, ' ');
}

function wrapPdfLine(value: string, maxLength = 96): string[] {
  if (value.length <= maxLength) {
    return [value];
  }

  const lines: string[] = [];
  for (let index = 0; index < value.length; index += maxLength) {
    lines.push(value.slice(index, index + maxLength));
  }
  return lines;
}

function toStatementPdf(rows: StatementRow[], filters: StatementExportFilters): string {
  const range = `${new Date(filters.from).toLocaleDateString()} - ${new Date(filters.to).toLocaleDateString()}`;
  const lines = [
    'Account statement',
    `Account: ${filters.accountId}`,
    `Date range: ${range}`,
    '',
    STATEMENT_COLUMNS.map((column) => column.header).join(' | '),
    ...rows.flatMap((row) =>
      wrapPdfLine(STATEMENT_COLUMNS.map((column) => String(row[column.key])).join(' | '))
    ),
  ];

  if (rows.length === 0) {
    lines.push('No statement activity found.');
  }

  const content = [
    'BT',
    '/F1 10 Tf',
    '40 760 Td',
    '14 TL',
    ...lines.map((line, index) => `${index === 0 ? '' : 'T* '}(${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
    .join('\n');
  pdf += `\ntrailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

function buildFilename(filters: StatementExportFilters, format: StatementExportFormat) {
  const from = filters.from.slice(0, 10);
  const to = filters.to.slice(0, 10);
  return `statement-${filters.accountId.slice(0, 8)}-${from}-${to}.${format === 'csv' ? 'csv' : 'pdf'}`;
}

export async function fetchStatementRows(
  filters: StatementExportFilters,
  fetcher: typeof fetch = fetch
): Promise<StatementRow[]> {
  assertFilters(filters);

  const rows: StatementRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetcher(buildStatementRowsUrl(filters, cursor));
    if (!response.ok) {
      throw new StatementExportError('Unable to fetch statement rows from the indexer.');
    }

    const page = (await response.json()) as IndexerStatementRowsResponse;
    rows.push(...page.rows.map(indexerRowToStatementRow));
    cursor = page.next_cursor ?? undefined;

    if (rows.length > MAX_EXPORT_ROWS) {
      throw new StatementExportError(
        'Narrow the date range before exporting more than 5,000 rows.'
      );
    }
  } while (cursor);

  return rows;
}

export class StatementExportService {
  async fetchRows(filters: StatementExportFilters): Promise<StatementRowsPage> {
    const rows = await fetchStatementRows(filters);
    return { rows };
  }

  async export(
    filters: StatementExportFilters,
    format: StatementExportFormat
  ): Promise<StatementExportResult> {
    const rows = await fetchStatementRows(filters);

    if (format === 'pdf') {
      const pdf = toStatementPdf(rows, filters);
      return {
        filename: buildFilename(filters, format),
        mimeType: 'application/pdf',
        blob: new Blob([pdf], { type: 'application/pdf' }),
      };
    }

    const csv = toStatementCsv(rows);
    return {
      filename: buildFilename(filters, format),
      mimeType: 'text/csv;charset=utf-8',
      blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    };
  }
}

export function downloadStatementExport(result: StatementExportResult) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
