import { useMemo, useState } from 'react';
import type { StatementExportFilters, StatementExportFormat, StatementRow } from '@ancore/types';

import {
  downloadStatementExport,
  StatementExportError,
  StatementExportService,
} from './statement-export';

interface StatementExportModalProps {
  accountId: string;
  isOpen: boolean;
  onClose: () => void;
  service?: StatementExportService;
  pdfEnabled?: boolean;
}

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function StatementExportModal({
  accountId,
  isOpen,
  onClose,
  service = new StatementExportService(),
  pdfEnabled = import.meta.env.VITE_STATEMENT_PDF_EXPORT === 'true',
}: StatementExportModalProps) {
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState(today);
  const [format, setFormat] = useState<StatementExportFormat>('csv');
  const [isLoading, setIsLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<StatementRow[]>([]);
  const [hasLoadedPreview, setHasLoadedPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo<StatementExportFilters>(
    () => ({
      accountId,
      from: `${from}T00:00:00.000Z`,
      to: `${to}T23:59:59.999Z`,
    }),
    [accountId, from, to]
  );

  if (!isOpen) {
    return null;
  }

  async function previewStatement() {
    setIsLoading(true);
    setError(null);
    try {
      const page = await service.fetchRows(filters);
      setPreviewRows(page.rows.slice(0, 5));
      setHasLoadedPreview(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to preview statement rows.');
      setPreviewRows([]);
      setHasLoadedPreview(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function exportStatement() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await service.export(filters, format);
      downloadStatementExport(result);
    } catch (caught) {
      setError(
        caught instanceof StatementExportError
          ? caught.message
          : 'Unable to export statement. Try again or narrow the date range.'
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      aria-labelledby="statement-export-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900" id="statement-export-title">
              Export statement
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Generate CSV records from indexer-backed account activity.
            </p>
          </div>
          <button
            className="rounded-lg px-3 py-2 text-sm text-slate-600"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Account
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              readOnly
              value={accountId}
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Format
            <select
              aria-label="Statement export format"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setFormat(event.target.value as StatementExportFormat)}
              value={format}
            >
              <option value="csv">CSV</option>
              {pdfEnabled ? <option value="pdf">PDF</option> : null}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            From
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-slate-700">
            To
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </label>
        </div>

        {error ? (
          <div
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-700">Preview</p>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
              disabled={isLoading}
              onClick={previewStatement}
              type="button"
            >
              {isLoading ? 'Loading…' : 'Load preview'}
            </button>
          </div>
          <div className="p-4">
            {isLoading ? <p className="text-sm text-slate-500">Fetching statement rows…</p> : null}
            {!isLoading && previewRows.length === 0 ? (
              <p className="text-sm text-slate-500">
                {hasLoadedPreview
                  ? 'No statement activity found for the selected range.'
                  : 'No statement rows loaded for this range yet.'}
              </p>
            ) : null}
            {previewRows.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {previewRows.map((row) => (
                  <li className="rounded-lg bg-slate-50 p-3" key={row.id}>
                    <span className="font-medium">{row.timestamp}</span> · {row.counterparty} ·{' '}
                    {row.amount} {row.asset} · {row.status}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isLoading}
            onClick={exportStatement}
            type="button"
          >
            {isLoading ? 'Exporting…' : 'Export statement'}
          </button>
        </div>
      </div>
    </div>
  );
}
