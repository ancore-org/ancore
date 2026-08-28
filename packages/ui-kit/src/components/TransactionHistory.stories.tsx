import type { Meta, StoryObj } from '@storybook/react';

import { TransactionHistory } from './TransactionHistory';

const mockTransactions = [
  {
    id: 'tx-101',
    type: 'received' as const,
    status: 'confirmed' as const,
    from: 'GA3RYQKDG5J7M6VF3P56Y6BRXBNVQXUR4J4XQ2HNVWIXSCNLS6R3V7DE',
    to: 'GDF2KJ5QMFPCZXHFVQ26DGIJQYUKJQCHM5ILWHR7IKK6QWFM2Q6ZA6VV',
    amount: '125.00',
    assetCode: 'XLM',
    timestamp: new Date(),
  },
  {
    id: 'tx-102',
    type: 'sent' as const,
    status: 'pending' as const,
    from: 'GDF2KJ5QMFPCZXHFVQ26DGIJQYUKJQCHM5ILWHR7IKK6QWFM2Q6ZA6VV',
    to: 'GA6THM6QBVZQEF4ZGEWHB7MJS2FZ2NHAWOE3K4R2L4HC5SLQVMFJ5U4N',
    amount: '40.75',
    assetCode: 'USDC',
    timestamp: new Date(Date.now() - 1000 * 60 * 40),
  },
  {
    id: 'tx-103',
    type: 'swap' as const,
    status: 'failed' as const,
    from: 'GA6THM6QBVZQEF4ZGEWHB7MJS2FZ2NHAWOE3K4R2L4HC5SLQVMFJ5U4N',
    to: 'GDF2KJ5QMFPCZXHFVQ26DGIJQYUKJQCHM5ILWHR7IKK6QWFM2Q6ZA6VV',
    amount: '300',
    assetCode: 'XLM',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26),
  },
];

const meta = {
  title: 'Wallet/TransactionHistory',
  component: TransactionHistory,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TransactionHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    transactions: mockTransactions,
    emptyMessage: 'No transactions yet',
  },
};

export const Loading: Story = {
  args: {
    transactions: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    transactions: [],
    emptyMessage: 'No transactions yet',
  },
};

/**
 * All items show the 'failed' status badge — simulates a block of transactions
 * that were rejected on-chain (e.g. after a network error or bad sequence number).
 */
export const ErrorState: Story = {
  name: 'Error State',
  parameters: {
    docs: {
      description: {
        story:
          'All transactions carry a `failed` status. Used to verify that the destructive badge and icon render correctly across every transaction type.',
      },
    },
  },
  args: {
    transactions: [
      {
        id: 'tx-err-1',
        type: 'sent' as const,
        status: 'failed' as const,
        from: 'GDF2KJ5QMFPCZXHFVQ26DGIJQYUKJQCHM5ILWHR7IKK6QWFM2Q6ZA6VV',
        to: 'GA3RYQKDG5J7M6VF3P56Y6BRXBNVQXUR4J4XQ2HNVWIXSCNLS6R3V7DE',
        amount: '50.00',
        assetCode: 'XLM',
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
      },
      {
        id: 'tx-err-2',
        type: 'swap' as const,
        status: 'failed' as const,
        from: 'GA3RYQKDG5J7M6VF3P56Y6BRXBNVQXUR4J4XQ2HNVWIXSCNLS6R3V7DE',
        to: 'GA6THM6QBVZQEF4ZGEWHB7MJS2FZ2NHAWOE3K4R2L4HC5SLQVMFJ5U4N',
        amount: '200.00',
        assetCode: 'USDC',
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
      },
    ],
  },
};

/**
 * Empty list with a context-specific message — mirrors the approval UI
 * when there are no pending transactions to display.
 */
export const EmptyApprovalQueue: Story = {
  name: 'Empty — Approval Queue',
  parameters: {
    docs: {
      description: {
        story:
          'Empty state with a custom `emptyMessage` matching the approval UI copy. Ensures the empty-state component picks up arbitrary message strings.',
      },
    },
  },
  args: {
    transactions: [],
    emptyMessage: 'No pending approvals',
  },
};

export const Mobile: Story = {
  args: {
    transactions: mockTransactions,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};
