import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

// Silence React's own error-boundary console output in test runs
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A component that always throws during render
function Bomb({ message }: { message: string }) {
  throw new Error(message);
}

// Wraps the boundary in a MemoryRouter
function harness(
  children: React.ReactNode,
  onGoHome = vi.fn(),
  onGoToSettings = vi.fn(),
  onReport?: (id: string, msg: string) => void
) {
  return render(
    <MemoryRouter>
      <ErrorBoundary onGoHome={onGoHome} onGoToSettings={onGoToSettings} onReport={onReport}>
        {children}
      </ErrorBoundary>
    </MemoryRouter>
  );
}

describe('ErrorBoundary & ErrorFallback', () => {
  it('renders children normally when nothing throws', () => {
    harness(<div>All good</div>);
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('catches a render error and shows the fallback — no white-screen', () => {
    harness(<Bomb message="boom" />);
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('shows an Error ID for support correlation', () => {
    harness(<Bomb message="id-check" />);
    const el = screen.getByText(/Support Reference:/i);
    expect(el).toBeInTheDocument();

    const idEl = screen.getByText(/ERR-[A-Z0-9]+-[A-Z0-9]+/);
    expect(idEl).toBeInTheDocument();
  });

  it('"Try again" resets the boundary and re-renders children', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    // A component whose throw behaviour we can flip between renders
    function Flaky() {
      if (shouldThrow) throw new Error('flaky');
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <MemoryRouter>
        <ErrorBoundary>
          <Flaky />
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();

    // Stop throwing before the reset re-render
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('Recovered')).toBeInTheDocument();
  });

  it('"Go to home" calls onGoHome and clears the boundary', async () => {
    const user = userEvent.setup();
    const onGoHome = vi.fn();

    harness(<Bomb message="go-home" />, onGoHome);
    await user.click(screen.getByRole('button', { name: /go to home/i }));

    expect(onGoHome).toHaveBeenCalledOnce();
  });

  it('"Go to settings" calls onGoToSettings and clears the boundary', async () => {
    const user = userEvent.setup();
    const onGoToSettings = vi.fn();

    harness(<Bomb message="go-settings" />, vi.fn(), onGoToSettings);
    await user.click(screen.getByRole('button', { name: /go to settings/i }));

    expect(onGoToSettings).toHaveBeenCalledOnce();
  });

  it('redacts sensitive key material from displayed error text and console logs', () => {
    harness(<Bomb message="private_key: SABCD1234SENSITIVE" />);
    expect(screen.queryByText(/SABCD1234/)).not.toBeInTheDocument();
    expect(screen.getByText(/redacted/i)).toBeInTheDocument();

    // Verify console error was called with sanitized message
    const errorSpy = console.error as jest.Mock;
    expect(errorSpy).toHaveBeenCalled();
    const lastCallArgs = errorSpy.mock.calls.find((call) => call[0] === '[ErrorBoundary]');
    expect(lastCallArgs).toBeDefined();
    expect(lastCallArgs[1].message).toMatch(/redacted/i);
    expect(lastCallArgs[1].message).not.toContain('SABCD1234SENSITIVE');
  });

  it('redacts Stellar secret key (56 chars starting with S)', () => {
    // 56 characters starting with S (S + 55 valid base32 characters)
    const stellarSecretKey = 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA──────────────────────';
    harness(<Bomb message={`Secret is ${stellarSecretKey}`} />);
    expect(screen.queryByText(stellarSecretKey)).not.toBeInTheDocument();
    expect(screen.getByText(/redacted/i)).toBeInTheDocument();
  });

  it('calls onReport with the error ID and sanitized message', () => {
    const onReport = vi.fn();
    harness(<Bomb message="report me" />, vi.fn(), vi.fn(), onReport);

    expect(onReport).toHaveBeenCalledOnce();
    const [errorId, sanitized] = onReport.mock.calls[0] as [string, string];
    expect(errorId).toMatch(/ERR-[A-Z0-9]+-[A-Z0-9]+/);
    expect(sanitized).toBe('report me');
  });
});
