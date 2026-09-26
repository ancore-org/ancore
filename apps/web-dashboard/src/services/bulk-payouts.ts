export type BulkPayoutStatus = 'pending' | 'success' | 'failed';

export interface BulkPayoutRow {
  id: string;
  lineNumber: number;
  recipient: string;
  amount: string;
  signedTransactionXdr?: string;
  status: BulkPayoutStatus;
  errors: string[];
}

export interface BulkPayoutParseResult {
  rows: BulkPayoutRow[];
  validRows: BulkPayoutRow[];
  invalidRows: BulkPayoutRow[];
  totalAmount: string;
}

export interface BulkPayoutExecution {
  row: BulkPayoutRow;
  status: Exclude<BulkPayoutStatus, 'pending'>;
  error?: string;
}

export interface BulkPayoutExecutionSummary {
  total: number;
  successful: number;
  failed: number;
  results: BulkPayoutExecution[];
}

export interface PayoutSubmission {
  recipient: string;
  amount: string;
  signedTransactionXdr?: string;
  idempotencyKey: string;
}

export type PayoutSubmitter = (submission: PayoutSubmission) => Promise<void>;

export interface RelayExecuteRequest {
  sessionKey: string;
  operation: 'relay_execute' | 'add_session_key' | 'revoke_session_key';
  parameters: Record<string, unknown>;
  signature: string;
  nonce: number;
}

export interface RelayerPayoutSubmitterOptions {
  baseUrl: string;
  getAuthToken: () => string | Promise<string>;
  buildRelayRequest: (
    submission: PayoutSubmission
  ) => RelayExecuteRequest | Promise<RelayExecuteRequest>;
  fetchImpl?: typeof fetch;
}

const REQUIRED_HEADERS = ['recipient', 'amount'] as const;
type CsvHeader = (typeof REQUIRED_HEADERS)[number] | 'signedTransactionXdr';
const HEADER_ALIASES: Record<string, CsvHeader> = {
  address: 'recipient',
  destination: 'recipient',
  recipient: 'recipient',
  to: 'recipient',
  amount: 'amount',
  signedtransactionxdr: 'signedTransactionXdr',
  signedxdr: 'signedTransactionXdr',
  xdr: 'signedTransactionXdr',
};
const STRKEY_ED25519_PUBLIC_KEY_VERSION_BYTE = 6 << 3;
const STRKEY_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAX_STROOPS = 9_223_372_036_854_775_807n;

export function parseBulkPayoutCsv(csv: string): BulkPayoutParseResult {
  const records = parseCsvRecords(csv);
  if (records.length === 0) {
    return toParseResult([]);
  }

  const headers = records[0].map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? '');
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    const row = createRow(1, '', '', undefined, [
      `Missing required column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(', ')}`,
    ]);
    return toParseResult([row]);
  }

  const recipientIndex = headers.indexOf('recipient');
  const amountIndex = headers.indexOf('amount');
  const signedTransactionXdrIndex = headers.indexOf('signedTransactionXdr');
  const rows = records.slice(1).reduce<BulkPayoutRow[]>((accumulator, record, index) => {
    if (record.every((cell) => cell.trim() === '')) {
      return accumulator;
    }

    const lineNumber = index + 2;
    const recipient = record[recipientIndex]?.trim() ?? '';
    const amount = normalizeAmount(record[amountIndex] ?? '');
    const signedTransactionXdr =
      signedTransactionXdrIndex === -1 ? undefined : record[signedTransactionXdrIndex]?.trim();
    accumulator.push(
      createRow(lineNumber, recipient, amount, signedTransactionXdr, validateRow(recipient, amount))
    );
    return accumulator;
  }, []);

  return toParseResult(rows);
}

/**
 * Rows submitted at once (#1349).
 *
 * A batch used to run strictly one row at a time, so a few hundred payouts
 * took a few hundred sequential round trips. Four is a deliberate compromise:
 * enough to hide per-request latency, low enough that the relayer sees a
 * trickle rather than a burst, and low enough that a batch failing for a
 * systemic reason does not fire hundreds of doomed requests before anyone
 * notices.
 */
export const BULK_PAYOUT_CONCURRENCY = 4;

/** Where an in-progress batch is checkpointed. */
export const BULK_PAYOUT_CHECKPOINT_KEY = 'ancore.bulk-payouts.checkpoint';

/** Bumped when the persisted shape changes, so an old checkpoint is discarded rather than misread. */
const CHECKPOINT_VERSION = 1;

/** One row's settled outcome, as persisted. The rows themselves are re-supplied by the caller. */
interface CheckpointEntry {
  status: Exclude<BulkPayoutStatus, 'pending'>;
  error?: string;
}

interface BulkPayoutCheckpoint {
  version: number;
  batchId: string;
  updatedAt: number;
  entries: Record<string, CheckpointEntry>;
}

/** The slice of `Storage` used here, so a test can pass a plain object. */
export interface CheckpointStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ExecuteBulkPayoutBatchOptions {
  /** Rows submitted concurrently. Defaults to `BULK_PAYOUT_CONCURRENCY`. */
  concurrency?: number;
  /**
   * Identifies this batch across reloads. Rows that already settled under the
   * same id are not resubmitted. Omit to disable checkpointing entirely.
   */
  batchId?: string;
  /** Defaults to `localStorage` when available. */
  storage?: CheckpointStorage | null;
  /** Called after every row settles, for progress UI. */
  onProgress?: (progress: { completed: number; total: number }) => void;
}

function defaultStorage(): CheckpointStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Storage access throws outright in some privacy modes. A batch must
    // still run; it just runs without resume.
    return null;
  }
}

function readCheckpoint(
  storage: CheckpointStorage | null,
  batchId: string | undefined
): Record<string, CheckpointEntry> {
  if (!storage || !batchId) return {};

  try {
    const raw = storage.getItem(BULK_PAYOUT_CHECKPOINT_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as BulkPayoutCheckpoint;
    // A checkpoint from a different batch, or an older shape, says nothing
    // about this one. Adopting it would report payouts that never happened.
    if (parsed.version !== CHECKPOINT_VERSION || parsed.batchId !== batchId) {
      return {};
    }
    return parsed.entries ?? {};
  } catch {
    return {};
  }
}

function writeCheckpoint(
  storage: CheckpointStorage | null,
  batchId: string | undefined,
  entries: Record<string, CheckpointEntry>
): void {
  if (!storage || !batchId) return;

  try {
    const checkpoint: BulkPayoutCheckpoint = {
      version: CHECKPOINT_VERSION,
      batchId,
      updatedAt: Date.now(),
      entries,
    };
    storage.setItem(BULK_PAYOUT_CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch {
    // An exhausted quota must not abort a batch that is moving real money.
    // Losing the ability to resume is bad; stopping halfway is worse.
  }
}

/** Discard a batch's checkpoint. Call once its summary has been recorded. */
export function clearBulkPayoutCheckpoint(
  storage: CheckpointStorage | null = defaultStorage()
): void {
  try {
    storage?.removeItem(BULK_PAYOUT_CHECKPOINT_KEY);
  } catch {
    // Nothing useful to do; the version and batchId guards make a stale
    // entry inert anyway.
  }
}

/**
 * Read back a persisted batch without submitting anything.
 *
 * Lets a page that reloaded mid-batch report what already settled, instead of
 * showing an empty summary while those payouts sit completed on-chain.
 * Returns `null` when there is nothing recorded for this batch.
 */
export function loadBulkPayoutCheckpoint(
  batchId: string,
  rows: BulkPayoutRow[],
  storage: CheckpointStorage | null = defaultStorage()
): BulkPayoutExecutionSummary | null {
  const entries = readCheckpoint(storage, batchId);
  const settled = rows.filter((row) => entries[row.id]);
  if (settled.length === 0) return null;

  const results: BulkPayoutExecution[] = settled.map((row) => ({
    row,
    status: entries[row.id].status,
    error: entries[row.id].error,
  }));

  const successful = results.filter((result) => result.status === 'success').length;
  return {
    total: rows.length,
    successful,
    failed: results.length - successful,
    results,
  };
}

/**
 * Execute a payout batch.
 *
 * Two changes over the original one-row-at-a-time loop (#1349):
 *
 *   * **Bounded concurrency.** Rows run `concurrency` at a time. Each row is
 *     still caught independently, so one failure never sinks its neighbours —
 *     which is why this is a worker pool rather than `Promise.all`.
 *   * **Checkpointing.** Every settled row is written to storage under
 *     `batchId` as it completes. If the tab closes mid-batch the submitted
 *     payouts are still recorded, and a resumed run skips them rather than
 *     paying twice.
 *
 * Results come back in the caller's row order regardless of completion order,
 * so the summary lines up with the table the user is looking at.
 */
export async function executeBulkPayoutBatch(
  rows: BulkPayoutRow[],
  submitPayout: PayoutSubmitter,
  options: ExecuteBulkPayoutBatchOptions = {}
): Promise<BulkPayoutExecutionSummary> {
  const {
    concurrency = BULK_PAYOUT_CONCURRENCY,
    batchId,
    storage = defaultStorage(),
    onProgress,
  } = options;

  const workers = Math.max(1, Math.min(concurrency, rows.length || 1));
  const entries = readCheckpoint(storage, batchId);
  const settled: Array<BulkPayoutExecution | undefined> = new Array(rows.length);

  let completed = 0;
  const report = (): void => {
    completed += 1;
    onProgress?.({ completed, total: rows.length });
  };

  // Rows already settled in a previous run of this batch are adopted as they
  // stand. Resubmitting one would be a second payment, which is the failure
  // this checkpoint exists to prevent.
  const pending: number[] = [];
  rows.forEach((row, index) => {
    const recorded = entries[row.id];
    if (recorded) {
      settled[index] = { row, status: recorded.status, error: recorded.error };
      report();
    } else {
      pending.push(index);
    }
  });

  let cursor = 0;
  const runWorker = async (): Promise<void> => {
    for (;;) {
      const next = cursor;
      cursor += 1;
      if (next >= pending.length) return;

      const index = pending[next];
      const row = rows[index];

      try {
        await submitPayout({
          recipient: row.recipient,
          amount: row.amount,
          signedTransactionXdr: row.signedTransactionXdr,
          idempotencyKey: `bulk-payout-${row.id}`,
        });
        settled[index] = { row, status: 'success' };
        entries[row.id] = { status: 'success' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Payout execution failed';
        settled[index] = { row, status: 'failed', error: message };
        entries[row.id] = { status: 'failed', error: message };
      }

      // Written per row, not per batch: a checkpoint saved only at the end
      // would be empty in exactly the case it exists for.
      writeCheckpoint(storage, batchId, entries);
      report();
    }
  };

  await Promise.all(Array.from({ length: workers }, () => runWorker()));

  const results = settled.filter((result): result is BulkPayoutExecution => result !== undefined);
  const successful = results.filter((result) => result.status === 'success').length;

  return {
    total: rows.length,
    successful,
    failed: results.length - successful,
    results,
  };
}

export function createRelayerPayoutSubmitter(
  options: RelayerPayoutSubmitterOptions
): PayoutSubmitter {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);

  return async (submission: PayoutSubmission) => {
    const token = await options.getAuthToken();
    const relayRequest = await options.buildRelayRequest(submission);
    const response = await fetchImpl(`${baseUrl}/relay/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': submission.idempotencyKey,
      },
      body: JSON.stringify(relayRequest),
    });

    const body = (await readJsonResponse(response)) as {
      success?: boolean;
      error?: { message?: string };
      message?: string;
    };

    if (!response.ok || body.success === false) {
      throw new Error(
        body.error?.message ?? body.message ?? `Payout relay request failed (${response.status})`
      );
    }
  };
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      record.push(field);
      field = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((row) => row.some((cell) => cell.trim() !== ''));
}

function createRow(
  lineNumber: number,
  recipient: string,
  amount: string,
  signedTransactionXdr: string | undefined,
  errors: string[]
): BulkPayoutRow {
  return {
    id: `${lineNumber}-${recipient}-${amount}`,
    lineNumber,
    recipient,
    amount,
    signedTransactionXdr,
    status: 'pending',
    errors,
  };
}

function validateRow(recipient: string, amount: string): string[] {
  const errors: string[] = [];

  if (!recipient) {
    errors.push('Recipient is required');
  } else if (!isValidEd25519PublicKey(recipient)) {
    errors.push('Recipient must be a valid Stellar G... public key');
  }

  if (!amount) {
    errors.push('Amount is required');
  } else if (!/^\d+(?:\.\d{1,7})?$/.test(amount)) {
    errors.push('Amount must be a positive decimal with up to 7 fractional digits');
  } else {
    const stroops = decimalToStroops(amount);
    if (stroops <= 0n) {
      errors.push('Amount must be greater than zero');
    } else if (stroops > MAX_STROOPS) {
      errors.push('Amount exceeds the Stellar maximum asset amount');
    }
  }

  return errors;
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function normalizeAmount(value: string): string {
  return value.trim();
}

function toParseResult(rows: BulkPayoutRow[]): BulkPayoutParseResult {
  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidRows = rows.filter((row) => row.errors.length > 0);

  return {
    rows,
    validRows,
    invalidRows,
    totalAmount: formatStroops(
      validRows.reduce((total, row) => total + decimalToStroops(row.amount), 0n)
    ),
  };
}

function decimalToStroops(amount: string): bigint {
  const [whole, fractional = ''] = amount.split('.');
  return BigInt(whole) * 10_000_000n + BigInt(fractional.padEnd(7, '0'));
}

function formatStroops(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const fractional = (stroops % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

function isValidEd25519PublicKey(value: string): boolean {
  if (!/^G[A-Z2-7]{55}$/.test(value)) {
    return false;
  }

  const decoded = decodeBase32(value);
  if (!decoded || decoded.length !== 35) {
    return false;
  }

  const payload = decoded.slice(0, 33);
  const checksum = decoded[33] | (decoded[34] << 8);
  return payload[0] === STRKEY_ED25519_PUBLIC_KEY_VERSION_BYTE && crc16Xmodem(payload) === checksum;
}

function decodeBase32(value: string): Uint8Array | null {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of value) {
    const digit = STRKEY_BASE32_ALPHABET.indexOf(char);
    if (digit === -1) {
      return null;
    }

    buffer = (buffer << 5) | digit;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
