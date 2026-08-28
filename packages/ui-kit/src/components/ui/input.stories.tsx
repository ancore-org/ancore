import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Example value',
    placeholder: 'Enter text...',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Email address',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Password',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    placeholder: 'Amount',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-[350px] space-y-2">
      <label className="text-sm font-medium">Email Address</label>
      <Input type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const WithError: Story = {
  args: {
    id: 'amount',
    placeholder: 'Enter amount',
    error: 'Amount must be greater than 0',
  },
};

export const WithErrorAndLabel: Story = {
  render: () => (
    <div className="w-[350px] space-y-1">
      <label htmlFor="recipient" className="text-sm font-medium">
        Recipient Address
      </label>
      <Input id="recipient" placeholder="G..." error="Invalid Stellar address" />
    </div>
  ),
};

export const FormExample: Story = {
  render: () => (
    <div className="w-[350px] space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Username</label>
        <Input placeholder="Enter username" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Email</label>
        <Input type="email" placeholder="you@example.com" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <Input type="password" placeholder="Enter password" />
      </div>
    </div>
  ),
};
