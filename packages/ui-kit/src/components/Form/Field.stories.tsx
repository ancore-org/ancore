import type { Meta, StoryObj } from '@storybook/react';
import { Field } from './Field';
import { Input } from '@/components/ui/input';

const meta = {
  title: 'Form/Field',
  component: Field,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[350px]">
      <Field label="Amount" description="Enter the amount to send.">
        <Input placeholder="0.00" />
      </Field>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div className="w-[350px]">
      <Field label="Recipient" error="Recipient address is required" required>
        <Input placeholder="G..." />
      </Field>
    </div>
  ),
};
