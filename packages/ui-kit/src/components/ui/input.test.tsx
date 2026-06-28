import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Input } from './input';
import { expectNoA11yViolations } from '../../__tests__/test-utils/a11y';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with value', () => {
    render(<Input value="Test value" readOnly />);
    expect(screen.getByDisplayValue('Test value')).toBeInTheDocument();
  });

  it('handles user input', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here');

    await user.type(input, 'Hello');
    expect(input).toHaveValue('Hello');
  });

  it('handles disabled state', () => {
    render(<Input disabled placeholder="Disabled" />);
    const input = screen.getByPlaceholderText('Disabled');
    expect(input).toBeDisabled();
  });

  it('supports different input types', () => {
    const { rerender } = render(<Input type="email" placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toHaveAttribute('type', 'email');

    rerender(<Input type="password" placeholder="Password" />);
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
  });

  it('has no axe violations when labelled', async () => {
    const { container } = render(
      <label>
        Email
        <Input type="email" />
      </label>
    );

    await expectNoA11yViolations(container);
  });

  describe('error slot', () => {
    it('renders error message when error prop is provided', () => {
      render(<Input id="amount" error="Amount is required" />);
      expect(screen.getByRole('alert')).toHaveTextContent('Amount is required');
    });

    it('sets aria-invalid when error is set', () => {
      render(<Input id="amount" placeholder="Amount" error="Invalid amount" />);
      expect(screen.getByPlaceholderText('Amount')).toHaveAttribute('aria-invalid', 'true');
    });

    it('links error text via aria-describedby', () => {
      render(<Input id="amount" placeholder="Amount" error="Too high" />);
      const input = screen.getByPlaceholderText('Amount');
      const errorEl = screen.getByRole('alert');
      expect(input).toHaveAttribute('aria-describedby', errorEl.id);
    });

    it('does not set aria-invalid when no error', () => {
      render(<Input placeholder="Amount" />);
      expect(screen.getByPlaceholderText('Amount')).not.toHaveAttribute('aria-invalid');
    });

    it('does not render error element when no error', () => {
      render(<Input placeholder="Amount" />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('has no axe violations with error state', async () => {
      const { container } = render(
        <div>
          <label htmlFor="email">Email</label>
          <Input id="email" type="email" error="Enter a valid email" />
        </div>
      );
      await expectNoA11yViolations(container);
    });
  });
});
