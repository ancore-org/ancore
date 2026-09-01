import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary, RouteErrorBoundary } from '../AppErrorBoundary';

/**
 * #1348: before this, an uncaught render error unmounted the entire React
 * tree and left a blank white page — no message, no navigation, nothing to
 * click. These assert that a throw is contained and that something usable is
 * rendered in its place.
 */

function Boom({ message = 'render exploded' }: { message?: string }): JSX.Element {
  throw new Error(message);
}

function Fine(): JSX.Element {
  return <p>Page content</p>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    // React logs the caught error itself; silence it so a passing test does
    // not print a stack trace that looks like a failure.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <Fine />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Page content')).toBeInTheDocument();
  });

  it('catches a render error instead of unmounting the tree', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('offers a reload, because re-rendering the same tree would throw again', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, reload },
    });

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: /reload the dashboard/i }));
    expect(reload).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('reports the error without dumping the whole error object', () => {
    render(
      <AppErrorBoundary>
        <Boom message="sensitive payload detail" />
      </AppErrorBoundary>
    );

    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const boundaryCall = logged.find(
      ([first]) => typeof first === 'string' && first.includes('[App Error Boundary]')
    );

    expect(boundaryCall).toBeDefined();
    // Name and message only — a thrown error in this app can carry addresses
    // and transaction payloads on other fields.
    expect(boundaryCall?.[1]).toEqual({ name: 'Error', message: 'sensitive payload detail' });
  });
});

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('contains a page-level throw and keeps the surrounding shell rendered', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/send']}>
        <nav aria-label="Dashboard">Navigation</nav>
        <RouteErrorBoundary>
          <Boom />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('This page could not be displayed')).toBeInTheDocument();
    // The chrome outside the boundary survived, so the user is not stranded.
    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
  });

  it('offers a retry that re-renders the route', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function Flaky(): JSX.Element {
      if (shouldThrow) throw new Error('transient');
      return <p>Recovered content</p>;
    }

    render(
      <MemoryRouter initialEntries={['/dashboard/send']}>
        <RouteErrorBoundary>
          <Flaky />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('This page could not be displayed')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteErrorBoundary>
          <Fine />
        </RouteErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
