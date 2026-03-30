import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { AddressInput } from '@/components/Form/AddressInput';

const VALID_ADDRESS = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37';

describe('AddressInput (standalone)', () => {
  it('renders with default label', () => {
    render(<AddressInput />);
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
  });

  it('renders with a custom label', () => {
    render(<AddressInput label="Send To" />);
    expect(screen.getByLabelText('Send To')).toBeInTheDocument();
  });

  it('uses monospace font class on the input', () => {
    render(<AddressInput label="Address" />);
    const input = screen.getByLabelText('Address');
    expect(input.className).toMatch(/font-mono/);
  });

  it('renders placeholder text', () => {
    render(<AddressInput placeholder="GABC..." />);
    expect(screen.getByPlaceholderText('GABC...')).toBeInTheDocument();
  });

  it('displays an error message when error prop is set', () => {
    render(<AddressInput error="Invalid Stellar address" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid Stellar address');
  });

  it('applies destructive border class when error is present', () => {
    render(<AddressInput error="Bad address" label="Address" />);
    const input = screen.getByLabelText('Address');
    expect(input.className).toMatch(/border-destructive/);
  });

  it('does NOT show error element when no error is provided', () => {
    render(<AddressInput />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('links aria-describedby to the error element id', () => {
    render(<AddressInput label="Recipient" error="Required" />);
    const input = screen.getByLabelText('Recipient');
    const error = screen.getByRole('alert');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('marks input as aria-invalid when error exists', () => {
    render(<AddressInput label="Address" error="Required" />);
    const input = screen.getByLabelText('Address');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('calls onChange when the user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AddressInput label="Address" onChange={onChange} />);
    await user.type(screen.getByLabelText('Address'), 'G');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders with a controlled value', () => {
    render(<AddressInput label="Address" value={VALID_ADDRESS} onChange={() => {}} />);
    expect(screen.getByLabelText<HTMLInputElement>('Address').value).toBe(VALID_ADDRESS);
  });

  it('is disabled when disabled prop is set', () => {
    render(<AddressInput label="Address" disabled />);
    expect(screen.getByLabelText('Address')).toBeDisabled();
  });

  it('has autocorrect and autocapitalize off', () => {
    render(<AddressInput label="Address" />);
    const input = screen.getByLabelText('Address');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'none');
  });
});
