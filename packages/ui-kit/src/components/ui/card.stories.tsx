import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Button } from './button';

const meta = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content</p>
      </CardContent>
    </Card>
  ),
};

export const WalletBalance: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Balance</CardTitle>
        <CardDescription>Your Stellar wallet balance</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">100.50 XLM</p>
        <p className="text-sm text-muted-foreground mt-2">≈ $12.50 USD</p>
      </CardContent>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Send Transaction</CardTitle>
        <CardDescription>Send XLM to another Stellar address</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Transaction details go here</p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Confirm</Button>
      </CardFooter>
    </Card>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Assets</CardTitle>
          <CardDescription>Your token holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>XLM</span>
              <span className="font-semibold">100.50</span>
            </div>
            <div className="flex justify-between">
              <span>USDC</span>
              <span className="font-semibold">25.00</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm">
              <p className="font-medium">Sent 10 XLM</p>
              <p className="text-muted-foreground">2 hours ago</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">Received 5 XLM</p>
              <p className="text-muted-foreground">1 day ago</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};
