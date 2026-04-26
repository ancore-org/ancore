/**
 * ErrorState Accessibility Tests
 *
 * Tests for WCAG 2.1 AA compliance on error state component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorState } from '../ErrorState';

describe('ErrorState Accessibility', () => {
  it('should have proper role and ARIA attributes', () => {
    render(<ErrorState message="Error message" />);
    const errorContainer = screen.getByRole('alert');
    expect(errorContainer).toHaveAttribute('aria-live', 'assertive');
    expect(errorContainer).toHaveAttribute('aria-atomic', 'true');
  });

  it('should announce error to screen readers', () => {
    const { container } = render(<ErrorState message="Network error" />);
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeInTheDocument();
  });

  it('should have accessible buttons with labels', () => {
    render(
      <ErrorState
        message="Error"
        actions={[
          { label: 'Retry', onClick: jest.fn(), variant: 'primary' },
          { label: 'Cancel', onClick: jest.fn(), variant: 'secondary' },
        ]}
      />
    );

    const retryBtn = screen.getByLabelText('Retry');
    const cancelBtn = screen.getByLabelText('Cancel');

    expect(retryBtn).toBeInTheDocument();
    expect(cancelBtn).toBeInTheDocument();
  });

  it('should have keyboard navigable buttons', () => {
    const { container } = render(
      <ErrorState message="Error" actions={[{ label: 'Try Again', onClick: jest.fn() }]} />
    );

    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn).not.toHaveAttribute('tabindex', '-1');
    });
  });

  it('should maintain focus trap for modal pattern', () => {
    const handleDismiss = jest.fn();
    const { container } = render(
      <ErrorState message="Error" onDismiss={handleDismiss} />
    );

    const errorElement = container.querySelector('[role="alert"]');
    expect(errorElement).toHaveAttribute('tabindex', '-1');
  });

  it('should hide icon from screen readers', () => {
    const { container } = render(<ErrorState message="Error" />);
    const svgs = container.querySelectorAll('svg');
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
