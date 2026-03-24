import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import * as React from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Separator, cn } from '@ancore/ui-kit';
import { format } from 'date-fns';
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { TransactionStatus } from '@/components/TransactionStatus';
import { getTransactionExplorerLink } from '@/utils/explorer-links';
function formatDateTime(value) {
  return format(new Date(value), 'MMM d, yyyy, h:mm a');
}
function getHeadline(transaction) {
  const assetCode = transaction.assetCode ?? 'XLM';
  const prefix =
    transaction.type === 'received'
      ? 'Received'
      : transaction.type === 'swap'
        ? 'Swapped'
        : transaction.type === 'payment'
          ? 'Payment'
          : 'Sent';
  return `${prefix} ${transaction.amount} ${assetCode}`;
}
function getCounterpartyLabel(type) {
  return type === 'received' ? 'From' : 'To';
}
async function copyText(value) {
  await navigator.clipboard.writeText(value);
}
function truncateHash(hash) {
  if (hash.length <= 16) {
    return hash;
  }
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}
export function TransactionDetail({ transaction, onBack, className }) {
  const [copied, setCopied] = React.useState(false);
  const explorerLink = getTransactionExplorerLink(
    transaction.hash,
    transaction.network ?? 'mainnet'
  );
  const handleCopy = React.useCallback(async () => {
    await copyText(transaction.hash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [transaction.hash]);
  return _jsxs(Card, {
    className: cn('mx-auto w-full max-w-md border-slate-200', className),
    children: [
      _jsxs(CardHeader, {
        className: 'space-y-4 pb-4',
        children: [
          _jsxs('div', {
            className: 'flex items-center gap-3',
            children: [
              _jsx(Button, {
                type: 'button',
                variant: 'ghost',
                size: 'icon',
                'aria-label': 'Go back',
                onClick: onBack,
                children: _jsx(ArrowLeft, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
              }),
              _jsx(CardTitle, { className: 'text-lg', children: 'Details' }),
            ],
          }),
          _jsx(TransactionStatus, { status: transaction.status }),
        ],
      }),
      _jsxs(CardContent, {
        className: 'space-y-6',
        children: [
          _jsxs('section', {
            className: 'space-y-2',
            children: [
              _jsx('p', {
                className: 'text-2xl font-semibold tracking-tight text-slate-950',
                children: getHeadline(transaction),
              }),
              _jsxs('p', {
                className: 'text-sm text-slate-600',
                children: [
                  getCounterpartyLabel(transaction.type),
                  ':',
                  ' ',
                  _jsx('span', {
                    className: 'font-mono text-slate-900',
                    children: transaction.type === 'received' ? transaction.from : transaction.to,
                  }),
                ],
              }),
            ],
          }),
          _jsx(Separator, {}),
          _jsxs('dl', {
            className: 'grid gap-4 text-sm sm:grid-cols-[minmax(120px,140px)_1fr]',
            children: [
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'From' }),
                  _jsx('dd', {
                    className: 'font-mono break-all text-slate-900',
                    children: transaction.from,
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'To' }),
                  _jsx('dd', {
                    className: 'font-mono break-all text-slate-900',
                    children: transaction.to,
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'Amount' }),
                  _jsxs('dd', {
                    className: 'text-slate-900',
                    children: [transaction.amount, ' ', transaction.assetCode ?? 'XLM'],
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'Fee' }),
                  _jsx('dd', { className: 'text-slate-900', children: transaction.fee }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'Memo' }),
                  _jsx('dd', {
                    className: 'break-words text-slate-900',
                    children: transaction.memo?.trim() ? transaction.memo : 'No memo',
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'Time' }),
                  _jsx('dd', {
                    className: 'text-slate-900',
                    children: formatDateTime(transaction.timestamp),
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'Block' }),
                  _jsx('dd', {
                    className: 'text-slate-900',
                    children: transaction.blockNumber ?? 'Not available',
                  }),
                ],
              }),
              _jsxs('div', {
                className: 'contents',
                children: [
                  _jsx('dt', { className: 'font-medium text-slate-500', children: 'TX Hash' }),
                  _jsxs('dd', {
                    className: 'space-y-3',
                    children: [
                      _jsx('code', {
                        className:
                          'block break-all rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-900',
                        title: transaction.hash,
                        children: truncateHash(transaction.hash),
                      }),
                      _jsxs('div', {
                        className: 'flex flex-wrap gap-3',
                        children: [
                          _jsxs(Button, {
                            type: 'button',
                            variant: 'outline',
                            size: 'sm',
                            onClick: handleCopy,
                            children: [
                              _jsx(Copy, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
                              copied ? 'Copied' : 'Copy',
                            ],
                          }),
                          _jsx(Button, {
                            type: 'button',
                            variant: 'outline',
                            size: 'sm',
                            asChild: true,
                            children: _jsxs('a', {
                              href: explorerLink,
                              target: '_blank',
                              rel: 'noreferrer',
                              'aria-label': 'View on Stellar Expert',
                              children: [
                                _jsx(ExternalLink, { className: 'h-4 w-4', 'aria-hidden': 'true' }),
                                'View Explorer',
                              ],
                            }),
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
export { copyText, formatDateTime, getCounterpartyLabel, getHeadline, truncateHash };
//# sourceMappingURL=TransactionDetail.js.map
