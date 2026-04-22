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
