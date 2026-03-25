import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { AmountInput } from '@/components/Form/AmountInput';

describe('AmountInput (standalone)', () => {
  it('renders with default label', () => {
    render(<AmountInput />);
    expect(screen.getByLabelText('Amount')).toBeInTheDocument();
  });

  it('renders with a custom label', () => {
    render(<AmountInput label="Transaction Amount" />);
    expect(screen.getByLabelText('Transaction Amount')).toBeInTheDocument();
  });

  it('renders the asset badge', () => {
    render(<AmountInput asset="XLM" />);
    expect(screen.getByText('XLM')).toBeInTheDocument();
  });

  it('defaults to XLM asset', () => {
    render(<AmountInput />);
    expect(screen.getByText('XLM')).toBeInTheDocument();
  });

  it('renders balance when provided', () => {
    render(<AmountInput balance="250.50" asset="XLM" />);
    expect(screen.getByText(/250\.50/)).toBeInTheDocument();
    expect(screen.getByText(/balance/i)).toBeInTheDocument();
  });

  it('does not render balance row when balance is not provided', () => {
    render(<AmountInput />);
    expect(screen.queryByText(/balance/i)).not.toBeInTheDocument();
  });

  it('displays an error message when error prop is set', () => {
    render(<AmountInput error="Insufficient balance" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Insufficient balance');
  });

  it('applies destructive border when error is set', () => {
    render(<AmountInput label="Amount" error="Error" />);
    const input = screen.getByLabelText('Amount');
    expect(input.className).toMatch(/border-destructive/);
  });

  it('renders a MAX button when onMax is provided', () => {
    render(<AmountInput onMax={() => {}} />);
    expect(screen.getByRole('button', { name: /max/i })).toBeInTheDocument();
  });

  it('does not render MAX button when onMax is not provided', () => {
    render(<AmountInput />);
    expect(screen.queryByRole('button', { name: /max/i })).not.toBeInTheDocument();
  });

  it('calls onMax when MAX button is clicked', async () => {
    const user = userEvent.setup();
    const onMax = vi.fn();
    render(<AmountInput onMax={onMax} />);
    await user.click(screen.getByRole('button', { name: /max/i }));
    expect(onMax).toHaveBeenCalledTimes(1);
  });

  it('allows numeric input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AmountInput label="Amount" onChange={onChange} />);
    await user.type(screen.getByLabelText('Amount'), '10.5');
    expect(onChange).toHaveBeenCalled();
  });

  it('has inputMode decimal for mobile keyboards', () => {
    render(<AmountInput label="Amount" />);
    expect(screen.getByLabelText('Amount')).toHaveAttribute('inputmode', 'decimal');
  });

  it('is disabled when disabled prop is set', () => {
    render(<AmountInput label="Amount" disabled />);
    expect(screen.getByLabelText('Amount')).toBeDisabled();
  });

  it('renders with a controlled value', () => {
    render(<AmountInput label="Amount" value="42.5" onChange={() => {}} />);
    expect(screen.getByLabelText<HTMLInputElement>('Amount').value).toBe('42.5');
  });
});
