import { format, isToday, isYesterday } from 'date-fns';

export type TransactionType = 'sent' | 'received' | 'swap' | 'payment' | 'deposit' | 'withdrawal';

export type TransactionStatus = 'confirmed' | 'pending' | 'failed' | 'cancelled';

export interface TransactionRecord {
  id: string;
  type: TransactionType | (string & {});
  status: TransactionStatus;
  from: string;
  to: string;
  amount: number | string;
  assetCode?: string;
  timestamp: string | Date;
}

export interface TransactionGroup {
  label: string;
  dateKey: string;
  items: TransactionRecord[];
}

export function formatTransactionAmount(
  value: number | string,
  assetCode = 'XLM',
  options?: Intl.NumberFormatOptions
): string {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return `0 ${assetCode}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
    ...options,
  }).format(parsed);

  return `${formatted} ${assetCode}`;
}

export function formatTime(value: string | Date): string {
  return format(new Date(value), 'h:mm a');
}

export function formatAddress(value: string, visibleCharacters = 6): string {
  if (value.length <= visibleCharacters * 2) {
    return value;
  }

  return `${value.slice(0, visibleCharacters)}...${value.slice(-visibleCharacters)}`;
}

export function getDateGroupLabel(value: string | Date): string {
  const date = new Date(value);

  if (isToday(date)) {
    return 'Today';
  }

  if (isYesterday(date)) {
    return 'Yesterday';
  }

  return format(date, 'MMMM d, yyyy');
}

export function groupTransactionsByDate(transactions: TransactionRecord[]): TransactionGroup[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const groupedMap = new Map<string, TransactionGroup>();

  for (const transaction of sorted) {
    const dateKey = format(new Date(transaction.timestamp), 'yyyy-MM-dd');

    if (!groupedMap.has(dateKey)) {
      groupedMap.set(dateKey, {
        label: getDateGroupLabel(transaction.timestamp),
        dateKey,
        items: [],
      });
    }

    groupedMap.get(dateKey)?.items.push(transaction);
  }

  return Array.from(groupedMap.values());
}
