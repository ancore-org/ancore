import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with value', () => {
    render(<Input value="Test value" readOnly />);
    expect(screen.getByDisplayValue('Test value')).toBeInTheDocument();
  });

  it('handles user input', () => {
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Hello' } });
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
});
