import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { Form } from '@/components/Form/Form';
import { AddressInput } from '@/components/Form/AddressInput';
import { AmountInput } from '@/components/Form/AmountInput';
import { stellarAddressSchema, amountSchema } from '@/components/Form/validation';

const VALID_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

const schema = z.object({
  recipient: stellarAddressSchema,
  amount: amountSchema,
});

describe('Form', () => {
  it('renders children and a submit button', () => {
    render(
      <Form onSubmit={() => {}}>
        <AddressInput label="Recipient" />
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    expect(screen.getByLabelText('Recipient')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('calls onSubmit with validated data when form is valid', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <Form onSubmit={handleSubmit} validationSchema={schema}>
        <AddressInput name="recipient" label="Recipient" />
        <AmountInput name="amount" label="Amount" />
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    await user.type(screen.getByLabelText('Recipient'), VALID_ADDRESS);
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        { recipient: VALID_ADDRESS, amount: '10' },
        expect.anything()
      );
    });
  });

  it('does NOT call onSubmit when validation fails', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(
      <Form onSubmit={handleSubmit} validationSchema={schema}>
        <AddressInput name="recipient" label="Recipient" />
        <AmountInput name="amount" label="Amount" />
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    // Leave fields empty
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  it('displays field-level error messages after failed submission', async () => {
    const user = userEvent.setup();

    render(
      <Form onSubmit={() => {}} validationSchema={schema}>
        <AddressInput name="recipient" label="Recipient" />
        <AmountInput name="amount" label="Amount" />
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      // Both required errors should be visible
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('displays invalid address error when address is wrong format', async () => {
    const user = userEvent.setup();

    render(
      <Form onSubmit={() => {}} validationSchema={schema}>
        <AddressInput name="recipient" label="Recipient" />
        <AmountInput name="amount" label="Amount" />
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    await user.type(screen.getByLabelText('Recipient'), 'not-valid');
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid stellar address/i)).toBeInTheDocument();
    });
  });

  it('renders submission-level error when error prop is provided', () => {
    render(
      <Form onSubmit={() => {}} error="Network timeout. Please try again.">
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/network timeout/i);
  });

  it('shows loading spinner on Form.Submit when loading=true', () => {
    render(
      <Form onSubmit={() => {}}>
        <Form.Submit loading>Sending</Form.Submit>
      </Form>
    );

    const button = screen.getByRole('button', { name: /sending/i });
    expect(button).toBeDisabled();
    // Spinner SVG exists inside the button
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('renders defaultValues into fields', () => {
    const defaultValues = { recipient: VALID_ADDRESS, amount: '5' };

    render(
      <Form onSubmit={() => {}} defaultValues={defaultValues}>
        <AddressInput name="recipient" label="Recipient" />
        <AmountInput name="amount" label="Amount" />
        <Form.Submit>Send</Form.Submit>
      </Form>
    );

    expect(screen.getByLabelText<HTMLInputElement>('Recipient').value).toBe(VALID_ADDRESS);
    expect(screen.getByLabelText<HTMLInputElement>('Amount').value).toBe('5');
  });
});
