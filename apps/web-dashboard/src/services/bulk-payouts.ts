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
  buildRelayRequest: (submission: PayoutSubmission) => RelayExecuteRequest;
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

export async function executeBulkPayoutBatch(
  rows: BulkPayoutRow[],
  submitPayout: PayoutSubmitter
): Promise<BulkPayoutExecutionSummary> {
  const results: BulkPayoutExecution[] = [];

  for (const row of rows) {
    try {
      await submitPayout({
        recipient: row.recipient,
        amount: row.amount,
        signedTransactionXdr: row.signedTransactionXdr,
        idempotencyKey: `bulk-payout-${row.id}`,
      });
      results.push({ row, status: 'success' });
    } catch (error) {
      results.push({
        row,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Payout execution failed',
      });
    }
  }

  const successful = results.filter((result) => result.status === 'success').length;
  return {
    total: rows.length,
    successful,
    failed: rows.length - successful,
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
    const response = await fetchImpl(`${baseUrl}/relay/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': submission.idempotencyKey,
      },
      body: JSON.stringify(options.buildRelayRequest(submission)),
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
