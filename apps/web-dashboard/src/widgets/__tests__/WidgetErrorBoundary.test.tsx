import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { WidgetErrorBoundary } from '../WidgetErrorBoundary';

// Mock lucide-react to avoid issues with SVG rendering in tests
vi.mock('lucide-react', () => ({
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
}));

// Mock @ancore/ui-kit elements
vi.mock('@ancore/ui-kit', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock throwing component
const BuggyWidget = ({ shouldThrow }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test Error: Widget Crashed');
  }
  return <div>Healthy Widget</div>;
};

describe('WidgetErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress expected console errors from React error boundary and our custom logger hook
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders child components when there is no error', () => {
    render(
      <WidgetErrorBoundary>
        <BuggyWidget />
      </WidgetErrorBoundary>
    );
    expect(screen.getByText('Healthy Widget')).toBeInTheDocument();
  });

  it('catches errors, invokes logger, and renders fallback with retry action', () => {
    render(
      <WidgetErrorBoundary>
        <BuggyWidget shouldThrow />
      </WidgetErrorBoundary>
    );

    expect(screen.getByText('Widget Failed')).toBeInTheDocument();
    expect(screen.getByText('Test Error: Widget Crashed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

    // Verifies our useWidgetErrorLogger was triggered
    expect(console.error).toHaveBeenCalledWith(
      '[Widget Error Logger] Caught isolated widget failure:',
      expect.any(Error)
    );
  });

  it('isolates failures so healthy widgets remain unaffected', () => {
    // Simulating sibling widgets wrapped inside their own respective boundaries
    render(
      <div data-testid="dashboard-grid">
        <WidgetErrorBoundary>
          <BuggyWidget shouldThrow />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary>
          <BuggyWidget />
        </WidgetErrorBoundary>
      </div>
    );

    // Ensure isolated failure behavior: One crashed, but the other survived
    expect(screen.getByText('Widget Failed')).toBeInTheDocument();
    expect(screen.getByText('Healthy Widget')).toBeInTheDocument();
  });
});