import { useMemo, useState, type ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2, Play, Upload } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@ancore/ui-kit';
import { buildDefaultRelayPayload, resolveRelayerBaseUrl } from '../services/scheduler-client';
import {
  createRelayerPayoutSubmitter,
  executeBulkPayoutBatch,
  parseBulkPayoutCsv,
  type BulkPayoutExecutionSummary,
  type BulkPayoutParseResult,
  type BulkPayoutRow,
  type PayoutSubmission,
} from '../services/bulk-payouts';
import { useDashboardAuth } from '../auth';

const EMPTY_PARSE_RESULT: BulkPayoutParseResult = {
  rows: [],
  validRows: [],
  invalidRows: [],
  totalAmount: '0',
};

export function BulkPayoutsPage() {
  const { session } = useDashboardAuth();
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<BulkPayoutParseResult>(EMPTY_PARSE_RESULT);
  const [executionSummary, setExecutionSummary] = useState<BulkPayoutExecutionSummary | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const failedExecutions = useMemo(
    () => executionSummary?.results.filter((result) => result.status === 'failed') ?? [],
    [executionSummary]
  );
  const submitPayoutToQueue = useMemo(
    () =>
      createRelayerPayoutSubmitter({
        baseUrl: resolveRelayerBaseUrl(import.meta.env.VITE_RELAYER_URL),
        getAuthToken: () => session?.accessToken ?? 'ancore-client-token',
        buildRelayRequest: (submission: PayoutSubmission) =>
          withSignedTransactionXdr(
            buildDefaultRelayPayload(submission.recipient, submission.amount),
            submission.signedTransactionXdr
          ),
      }),
    [session?.accessToken]
  );

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setExecutionSummary(null);
    setFileError(null);

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Upload a CSV file with recipient and amount columns.');
      setFileName('');
      setParseResult(EMPTY_PARSE_RESULT);
      return;
    }

    const text = await file.text();
    setFileName(file.name);
    setParseResult(parseBulkPayoutCsv(text));
  };

  const executeBatch = async () => {
    if (parseResult.validRows.length === 0 || parseResult.invalidRows.length > 0) {
      return;
    }

    setIsExecuting(true);
    try {
      setExecutionSummary(await executeBulkPayoutBatch(parseResult.validRows, submitPayoutToQueue));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-semibold">Bulk Payouts</h2>
        <p className="mt-2 text-sm text-slate-600">
          Import recipient and amount rows, review validation results, then execute the approved
          payout batch.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>CSV import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            <span>{fileName || 'Upload payout CSV'}</span>
            <input
              accept=".csv,text/csv"
              className="sr-only"
              onChange={onFileSelected}
              type="file"
            />
          </label>

          {fileError && (
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {fileError}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryTile label="Rows" value={parseResult.rows.length.toString()} />
            <SummaryTile label="Valid" value={parseResult.validRows.length.toString()} />
            <SummaryTile label="Invalid" value={parseResult.invalidRows.length.toString()} />
            <SummaryTile label="Total XLM" value={parseResult.totalAmount} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {parseResult.rows.length === 0 ? (
            <p className="text-sm text-slate-500">No payout rows imported.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Line</th>
                    <th className="py-2 pr-4">Recipient</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Signed XDR</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.map((row) => (
                    <PreviewRow key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          {parseResult.invalidRows.length > 0
            ? 'Fix invalid rows before executing this batch.'
            : 'Validated batches execute sequentially through the payout queue.'}
        </p>
        <Button
          disabled={
            isExecuting || parseResult.validRows.length === 0 || parseResult.invalidRows.length > 0
          }
          onClick={() => void executeBatch()}
          type="button"
        >
          <Play className="h-4 w-4" />
          {isExecuting ? 'Executing...' : 'Execute payout batch'}
        </Button>
      </div>

      {executionSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Execution summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryTile label="Submitted" value={executionSummary.total.toString()} />
              <SummaryTile label="Successful" value={executionSummary.successful.toString()} />
              <SummaryTile label="Failed" value={executionSummary.failed.toString()} />
            </div>

            {failedExecutions.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                All payout rows completed.
              </p>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-900">Failed-row report</h3>
                {failedExecutions.map((result) => (
                  <p key={result.row.id} className="text-sm text-red-600">
                    Line {result.row.lineNumber}: {result.error}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function withSignedTransactionXdr<T extends { parameters: Record<string, unknown> }>(
  request: T,
  signedTransactionXdr?: string
): T {
  if (!signedTransactionXdr) {
    return request;
  }

  return {
    ...request,
    parameters: {
      ...request.parameters,
      signedTransactionXdr,
    },
  };
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PreviewRow({ row }: { row: BulkPayoutRow }) {
  const isValid = row.errors.length === 0;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-4 text-slate-600">{row.lineNumber}</td>
      <td className="py-3 pr-4 font-mono text-xs">{row.recipient || '-'}</td>
      <td className="py-3 pr-4">{row.amount || '-'}</td>
      <td className="py-3 pr-4">{row.signedTransactionXdr ? 'Provided' : '-'}</td>
      <td className="py-3 pr-4">
        <Badge variant={isValid ? 'default' : 'destructive'}>{isValid ? 'Valid' : 'Invalid'}</Badge>
      </td>
      <td className="py-3 text-slate-600">{isValid ? '-' : row.errors.join('; ')}</td>
    </tr>
  );
}
