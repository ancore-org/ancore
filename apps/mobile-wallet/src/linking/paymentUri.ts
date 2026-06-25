export interface ParsedPaymentUri {
  dest: string;
  amount?: string;
}

const SUPPORTED_SCHEMES = new Set(['stellar', 'web+stellar']);
const DESTINATION_RE = /^G[A-Z2-7]{55}$/;

function isValidAmount(amount: string): boolean {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(amount)) {
    return false;
  }

  return Number(amount) > 0;
}

export function parsePaymentUri(uri: string): ParsedPaymentUri | null {
  const trimmed = uri.trim();
  const schemeSeparator = trimmed.indexOf(':');

  if (schemeSeparator <= 0) {
    return null;
  }

  const scheme = trimmed.slice(0, schemeSeparator).toLowerCase();
  if (!SUPPORTED_SCHEMES.has(scheme)) {
    return null;
  }

  const payload = trimmed.slice(schemeSeparator + 1);
  const querySeparator = payload.indexOf('?');
  const action = (querySeparator >= 0 ? payload.slice(0, querySeparator) : payload)
    .replace(/^\/+/, '')
    .toLowerCase();

  if (action !== 'pay' || querySeparator < 0) {
    return null;
  }

  const params = new URLSearchParams(payload.slice(querySeparator + 1));
  const dest = params.get('destination') ?? params.get('dest');

  if (!dest || !DESTINATION_RE.test(dest)) {
    return null;
  }

  const amount = params.get('amount') ?? undefined;
  if (amount !== undefined && !isValidAmount(amount)) {
    return null;
  }

  return amount ? { dest, amount } : { dest };
}
