import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from './separator';

const meta = {
  title: 'UI/Separator',
  component: Separator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[300px]">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Wallet Info</h4>
        <p className="text-sm text-muted-foreground">View your wallet details</p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>Balance</div>
        <Separator orientation="vertical" />
        <div>Transactions</div>
        <Separator orientation="vertical" />
        <div>Settings</div>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-[100px] items-center space-x-4">
      <div>Section 1</div>
      <Separator orientation="vertical" />
      <div>Section 2</div>
      <Separator orientation="vertical" />
      <div>Section 3</div>
    </div>
  ),
};

export const InCard: Story = {
  render: () => (
    <div className="w-[350px] rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <h3 className="text-2xl font-semibold">Account Details</h3>
      </div>
      <Separator />
      <div className="p-6">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Address:</span>
            <span className="text-sm font-mono">GABC...XYZ</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Balance:</span>
            <span className="text-sm font-semibold">100.50 XLM</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Network:</span>
            <span className="text-sm">Mainnet</span>
          </div>
        </div>
      </div>
    </div>
  ),
};
