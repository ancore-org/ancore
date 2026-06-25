import type { Meta, StoryObj } from '@storybook/react';

import { MerchantBadge } from './MerchantBadge';

const meta = {
  title: 'Components/MerchantBadge',
  component: MerchantBadge,
  parameters: {
    docs: {
      description: {
        component:
          'Merchant verification chip that maps verified, pending, unverified, and unknown states to ui-kit design tokens: primary, secondary, destructive, muted, and border.',
      },
    },
  },
  argTypes: {
    status: {
      control: 'select',
      options: ['verified', 'pending', 'unverified', 'unknown'],
      description: 'Merchant verification status derived from Horizon or indexer metadata.',
    },
    merchantName: {
      control: 'text',
      description: 'Included in the accessible name for screen reader context.',
    },
  },
  args: {
    merchantName: 'Acme Treasury',
    status: 'verified',
  },
} satisfies Meta<typeof MerchantBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Verified: Story = {};

export const Pending: Story = {
  args: { status: 'pending', merchantName: 'New Merchant' },
};

export const Unverified: Story = {
  args: { status: 'unverified', merchantName: 'Unknown POS' },
};

export const UnknownFallback: Story = {
  args: { status: 'unknown', merchantName: 'Legacy Merchant' },
};
