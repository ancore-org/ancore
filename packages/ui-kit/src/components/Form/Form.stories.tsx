import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { z } from 'zod';
import { Form } from './Form';
import { AddressInput } from './AddressInput';
import { AmountInput } from './AmountInput';
import { PasswordInput } from './PasswordInput';
import { stellarAddressSchema, amountSchema, passwordSchema } from './validation';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: 'Forms/Form',
  component: Form,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Send Transaction form
// ---------------------------------------------------------------------------

const sendSchema = z.object({
  recipient: stellarAddressSchema,
  amount: amountSchema,
  password: passwordSchema,
});

type SendData = z.infer<typeof sendSchema>;

export const SendTransaction: Story = {
  name: 'Send Transaction Form',
  args: { onSubmit: () => {}, children: null },
  render: () => {
    const [submitted, setSubmitted] = useState<SendData | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (data: SendData) => {
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 1000));
      setSubmitting(false);
      setSubmitted(data);
    };

    return (
      <div className="w-[400px] space-y-6">
        <Form onSubmit={handleSubmit} validationSchema={sendSchema}>
          <AddressInput name="recipient" label="Send To" placeholder="GABC..." />
          <AmountInput name="amount" label="Amount" balance="100.50" asset="XLM" />
          <PasswordInput name="password" label="Wallet Password" showStrength />
          <Form.Submit loading={submitting}>Send Transaction</Form.Submit>
        </Form>

        {submitted && (
          <div className="rounded-md border border-green-500 bg-green-50 p-3 text-sm">
            <p className="font-semibold text-green-700">Submitted!</p>
            <pre className="mt-1 text-xs text-green-600 break-all whitespace-pre-wrap">
              {JSON.stringify(submitted, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  },
};

// ---------------------------------------------------------------------------
// Individual component stories
// ---------------------------------------------------------------------------

export const AddressInputStory: Story = {
  name: 'AddressInput (standalone)',
  args: { onSubmit: () => {}, children: null },
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[400px]">
        <AddressInput
          label="Recipient Address"
          placeholder="GABC..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
    );
  },
};

export const AddressInputWithError: Story = {
  name: 'AddressInput (with error)',
  args: { onSubmit: () => {}, children: null },
  render: () => (
    <div className="w-[400px]">
      <AddressInput
        label="Recipient Address"
        value="NOT_A_VALID_ADDRESS"
        onChange={() => {}}
        error="Invalid Stellar address. Must start with G and be 56 characters."
      />
    </div>
  ),
};

export const AmountInputStory: Story = {
  name: 'AmountInput (standalone)',
  args: { onSubmit: () => {}, children: null },
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[400px]">
        <AmountInput
          label="Amount"
          balance="250.00"
          asset="XLM"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onMax={() => setValue('250.00')}
        />
      </div>
    );
  },
};

export const AmountInputWithError: Story = {
  name: 'AmountInput (with error)',
  args: { onSubmit: () => {}, children: null },
  render: () => (
    <div className="w-[400px]">
      <AmountInput
        label="Amount"
        balance="100.00"
        asset="XLM"
        value="500"
        onChange={() => {}}
        error="Insufficient balance"
      />
    </div>
  ),
};

export const PasswordInputStory: Story = {
  name: 'PasswordInput (standalone)',
  args: { onSubmit: () => {}, children: null },
  render: () => {
    const [value, setValue] = useState('');
    return (
      <div className="w-[400px]">
        <PasswordInput
          label="Password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          showStrength
        />
      </div>
    );
  },
};

export const PasswordInputWithError: Story = {
  name: 'PasswordInput (with error)',
  args: { onSubmit: () => {}, children: null },
  render: () => (
    <div className="w-[400px]">
      <PasswordInput
        label="Password"
        value="short"
        onChange={() => {}}
        showStrength
        error="Password must be at least 8 characters"
      />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

export const FormSubmitting: Story = {
  name: 'Form (submitting state)',
  args: { onSubmit: () => {}, children: null },
  render: () => (
    <div className="w-[400px]">
      <Form onSubmit={() => {}}>
        <AddressInput label="Recipient" placeholder="GABC..." />
        <AmountInput label="Amount" asset="XLM" />
        <Form.Submit loading>Sending…</Form.Submit>
      </Form>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Server error
// ---------------------------------------------------------------------------

export const FormWithServerError: Story = {
  name: 'Form (server error)',
  args: { onSubmit: () => {}, children: null },
  render: () => (
    <div className="w-[400px]">
      <Form onSubmit={() => {}} error="Transaction failed: network timeout. Please try again.">
        <AddressInput
          label="Recipient"
          value="GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37"
          onChange={() => {}}
        />
        <AmountInput label="Amount" asset="XLM" value="10" onChange={() => {}} />
        <Form.Submit>Send</Form.Submit>
      </Form>
    </div>
  ),
};
