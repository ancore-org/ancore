import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './button';
import { expectNoA11yViolations } from '../../__tests__/test-utils/a11y';

describe('Button', () => {
  it('renders with children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('renders with default variant', () => {
    render(<Button>Default</Button>);
    const button = screen.getByText('Default');
    expect(button).toHaveClass('bg-primary');
  });

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByText('Delete');
    expect(button).toHaveClass('bg-destructive');
  });

  it('renders with outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByText('Outline');
    expect(button).toHaveClass('border');
  });

  it('handles disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });

  it('renders different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByText('Small')).toHaveClass('h-9');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByText('Large')).toHaveClass('h-11');
  });

  it('has no axe violations in the default state', async () => {
    const { container } = render(<Button>Accessible action</Button>);

    await expectNoA11yViolations(container);
  });

  it('renders loading spinner and sets aria-busy', () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole('button', { name: /submit/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
  });

  it('prevents click events when loading', () => {
    let clicked = false;
    render(
      <Button
        loading
        onClick={() => {
          clicked = true;
        }}
      >
        Submit
      </Button>
    );
    const button = screen.getByRole('button', { name: /submit/i });
    button.click();
    expect(clicked).toBe(false);
    expect(button).toBeDisabled();
  });
});
