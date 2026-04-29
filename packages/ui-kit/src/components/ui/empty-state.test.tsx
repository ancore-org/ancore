import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders the title', () => {
    render(<EmptyState title="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders the description if provided', () => {
    render(<EmptyState title="Title" description="Some description" />);
    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  it('renders the action if provided', () => {
    render(
      <EmptyState
        title="Title"
        action={<button>Click Me</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });

  it('renders the icon if provided', () => {
    render(
      <EmptyState
        title="Title"
        icon={<div data-testid="test-icon">Icon</div>}
      />
    );
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });
});
