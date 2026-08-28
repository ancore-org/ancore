import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationProvider } from '../components/Toast/NotificationProvider';
import { useToast } from '../components/Toast/useToast';

function Trigger({ variant }: { variant?: 'success' | 'error' | 'warning' | 'info' }) {
  const { toast } = useToast();
  return <button onClick={() => toast('Test message', variant)}>Show Toast</button>;
}

function ConvenienceTrigger({
  method,
}: {
  method: 'showSuccess' | 'showError' | 'showWarning' | 'showInfo';
}) {
  const hook = useToast();
  return <button onClick={() => hook[method]('Test message')}>Show Toast</button>;
}

function setup(variant?: 'success' | 'error' | 'warning' | 'info') {
  return render(
    <NotificationProvider>
      <Trigger variant={variant} />
    </NotificationProvider>
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a toast when triggered', () => {
    setup();
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders success variant', () => {
    setup('success');
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toHaveClass('bg-success/10');
  });

  it('renders error variant', () => {
    setup('error');
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toHaveClass('bg-destructive/10');
  });

  it('renders warning variant', () => {
    setup('warning');
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toHaveClass('bg-warning/10');
  });

  it('renders info variant', () => {
    setup('info');
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toHaveClass('bg-info/10');
  });

  it('auto-dismisses after duration', () => {
    setup();
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dismisses on close button click', () => {
    setup();
    fireEvent.click(screen.getByText('Show Toast'));
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('throws when useToast is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(
      'useToast must be used within a NotificationProvider'
    );
    spy.mockRestore();
  });

  it('limits queue to 5 toasts', () => {
    const { getByText, getAllByRole } = render(
      <NotificationProvider>
        <Trigger />
      </NotificationProvider>
    );
    for (let i = 0; i < 7; i++) fireEvent.click(getByText('Show Toast'));
    expect(getAllByRole('alert').length).toBeLessThanOrEqual(5);
  });

  describe('convenience methods', () => {
    it.each(['showSuccess', 'showError', 'showWarning', 'showInfo'] as const)(
      '%s shows a toast',
      (method) => {
        render(
          <NotificationProvider>
            <ConvenienceTrigger method={method} />
          </NotificationProvider>
        );
        fireEvent.click(screen.getByText('Show Toast'));
        expect(screen.getByRole('alert')).toBeInTheDocument();
      }
    );
  });
});
