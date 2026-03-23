import type { Meta, StoryObj } from '@storybook/react';
import { AmountInput } from './amount-input';
import { useState } from 'react';

const meta = {
  title: 'Wallet/AmountInput',
  component: AmountInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AmountInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    balance: '100.50',
    asset: 'XLM',
  },
  render: (args) => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[350px]">
        <AmountInput {...args} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};

export const WithValue: Story = {
  args: {
    balance: '100.50',
    asset: 'XLM',
  },
  render: (args) => {
    const [value, setValue] = useState('25.00');
    return (
      <div className="w-[350px]">
        <AmountInput {...args} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};

export const WithError: Story = {
  args: {
    balance: '100.50',
    asset: 'XLM',
    error: 'Insufficient balance',
  },
  render: (args) => {
    const [value, setValue] = useState('150.00');
    return (
      <div className="w-[350px]">
        <AmountInput {...args} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};

export const DifferentAssets: Story = {
  render: () => {
    const [xlmValue, setXlmValue] = useState('');
    const [usdcValue, setUsdcValue] = useState('');

    return (
      <div className="w-[350px] space-y-4">
        <AmountInput
          balance="100.50"
          asset="XLM"
          label="Send Amount (XLM)"
          value={xlmValue}
          onChange={(e) => setXlmValue(e.target.value)}
        />
        <AmountInput
          balance="50.00"
          asset="USDC"
          label="Send Amount (USDC)"
          value={usdcValue}
          onChange={(e) => setUsdcValue(e.target.value)}
        />
      </div>
    );
  },
};

export const CustomLabel: Story = {
  args: {
    balance: '100.50',
    asset: 'XLM',
    label: 'Transaction Amount',
  },
  render: (args) => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[350px]">
        <AmountInput {...args} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    balance: '100.50',
    asset: 'XLM',
    disabled: true,
  },
  render: (args) => {
    const [value, setValue] = useState('10.00');
    return (
      <div className="w-[350px]">
        <AmountInput {...args} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};
