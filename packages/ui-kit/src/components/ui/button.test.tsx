import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button, StableButtonContent } from './button';

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
});

describe('StableButtonContent', () => {
  it('keeps both button states in the layout while hiding inactive content', () => {
    const { container } = render(
      <Button>
        <StableButtonContent isLoading={false} loadingContent="Saving...">
          Save changes
        </StableButtonContent>
      </Button>
    );

    expect(container.querySelector('[aria-hidden="false"]')).not.toHaveClass('invisible');
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('invisible');
  });

  it('shows loading content without removing the idle label from layout', () => {
    const { container } = render(
      <Button>
        <StableButtonContent isLoading loadingContent="Saving...">
          Save changes
        </StableButtonContent>
      </Button>
    );

    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('invisible');
    expect(container.querySelector('[aria-hidden="false"]')).not.toHaveClass('invisible');
  });
});
