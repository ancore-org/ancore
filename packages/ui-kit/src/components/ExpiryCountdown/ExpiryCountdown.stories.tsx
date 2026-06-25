import type { Meta, StoryObj } from '@storybook/react';

import { ExpiryCountdown } from './ExpiryCountdown';

const now = Date.now();

const meta = {
  title: 'Components/ExpiryCountdown',
  component: ExpiryCountdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Relative session-key expiry countdown with optional refresh CTA, polite live-region announcements, and per-minute updates.',
      },
    },
  },
  args: {
    onRefresh: () => undefined,
  },
} satisfies Meta<typeof ExpiryCountdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    expiresAt: now + 3 * 86_400_000,
  },
};

export const ExpiringSoon: Story = {
  args: {
    expiresAt: now + 30 * 60_000,
  },
};

export const Expired: Story = {
  args: {
    expiresAt: now - 60_000,
  },
};

export const Revoked: Story = {
  args: {
    expiresAt: 0,
  },
};

export const RefreshLoading: Story = {
  args: {
    expiresAt: now + 2 * 86_400_000,
    refreshLoading: true,
  },
};
