import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { FileText, Inbox } from 'lucide-react';
import { EmptyState } from './empty-state';
import { Button } from './button';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'No items found',
    description: 'You do not have any items in this list yet.',
  },
};

export const WithIcon: Story = {
  args: {
    icon: <Inbox className="h-6 w-6" />,
    title: 'Inbox is empty',
    description: 'When you receive messages, they will appear here.',
  },
};

export const WithAction: Story = {
  args: {
    icon: <FileText className="h-6 w-6" />,
    title: 'No transactions',
    description: 'Get started by creating your first transaction.',
    action: <Button>Create Transaction</Button>,
  },
};
