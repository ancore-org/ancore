import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { AmountInput } from './amount-input';

describe('AmountInput', () => {
  it('renders with label and asset badge', () => {
    render(<AmountInput balance="100.50" asset="XLM" />);
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('XLM')).toBeInTheDocument();
  });

  it('displays balance information', () => {
    render(<AmountInput balance="100.50" asset="XLM" />);
    expect(screen.getByText(/100.50 XLM/)).toBeInTheDocument();
  });

  it('shows custom label when provided', () => {
    render(<AmountInput label="Send Amount" balance="50" asset="USDC" />);
    expect(screen.getByText('Send Amount')).toBeInTheDocument();
  });

  it('displays error message when provided', () => {
    render(<AmountInput error="Insufficient balance" balance="10" asset="XLM" />);
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    render(<AmountInput disabled balance="100" asset="XLM" />);
    const input = screen.getByPlaceholderText('0.00');
    expect(input).toBeDisabled();
  });

  // Behaviour gained by delegating to AmountInputBase (issue #1246).
  it('renders a decimal text input rather than a raw number input', () => {
    render(<AmountInput balance="100" asset="XLM" />);
    const input = screen.getByPlaceholderText('0.00');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'decimal');
  });

  it('wires aria-invalid and aria-describedby to the error message', () => {
    render(<AmountInput error="Insufficient balance" balance="10" asset="XLM" />);
    const input = screen.getByPlaceholderText('0.00');
    const errorId = input.getAttribute('aria-describedby');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId as string)).toHaveTextContent('Insufficient balance');
  });

  it('associates the label with the input', () => {
    render(<AmountInput label="Send Amount" balance="50" asset="USDC" />);
    expect(screen.getByLabelText('Send Amount')).toBe(screen.getByPlaceholderText('0.00'));
  });

  it('sanitises non-decimal characters typed into the field', async () => {
    const user = userEvent.setup();
    render(<AmountInput balance="100" asset="XLM" />);
    const input = screen.getByPlaceholderText('0.00') as HTMLInputElement;

    await user.type(input, '1e2a.5');

    expect(input.value).toBe('12.5');
  });
});
