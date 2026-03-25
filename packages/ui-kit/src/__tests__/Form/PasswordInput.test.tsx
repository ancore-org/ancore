import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/Form/PasswordInput';

describe('PasswordInput (standalone)', () => {
  it('renders with default label', () => {
    render(<PasswordInput />);
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('renders with a custom label', () => {
    render(<PasswordInput label="Wallet Password" />);
    expect(screen.getByLabelText('Wallet Password')).toBeInTheDocument();
  });

  it('starts as type="password"', () => {
    render(<PasswordInput label="Password" />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('toggles to type="text" when show button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);

    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleBtn);

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  });

  it('toggles back to type="password" on second click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" />);

    const toggleBtn = screen.getByRole('button', { name: /show password/i });
    await user.click(toggleBtn);
    await user.click(screen.getByRole('button', { name: /hide password/i }));

    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('toggle button has accessible label "Show password" initially', () => {
    render(<PasswordInput />);
    expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
  });

  it('toggle button label changes to "Hide password" when visible', async () => {
    const user = userEvent.setup();
    render(<PasswordInput />);
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });

  it('does NOT render strength meter by default', () => {
    render(<PasswordInput label="Password" value="" onChange={() => {}} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders strength meter when showStrength is true and value is non-empty', () => {
    render(<PasswordInput label="Password" value="hello123" onChange={() => {}} showStrength />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not render strength meter when showStrength=true but value is empty', () => {
    render(<PasswordInput label="Password" value="" onChange={() => {}} showStrength />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('strength meter reflects password complexity', () => {
    const { rerender } = render(
      <PasswordInput label="Password" value="weakpass" onChange={() => {}} showStrength />
    );
    const weakPercent = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));

    rerender(
      <PasswordInput label="Password" value="Str0ng!Pass#99" onChange={() => {}} showStrength />
    );
    const strongPercent = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));

    expect(strongPercent).toBeGreaterThan(weakPercent);
  });

  it('displays error message when error prop is set', () => {
    render(<PasswordInput label="Password" error="Too short" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('applies destructive border when error is set', () => {
    render(<PasswordInput label="Password" error="Required" />);
    expect(screen.getByLabelText('Password')).toHaveClass('border-destructive');
  });

  it('does NOT show error element without error prop', () => {
    render(<PasswordInput />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PasswordInput label="Password" onChange={onChange} />);
    await user.type(screen.getByLabelText('Password'), 'secret');
    expect(onChange).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is set', () => {
    render(<PasswordInput label="Password" disabled />);
    expect(screen.getByLabelText('Password')).toBeDisabled();
  });
});
