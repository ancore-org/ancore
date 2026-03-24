import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationProvider } from '../components/Toast/NotificationProvider';
import { useToast } from '../components/Toast/useToast';

function Trigger({ variant }: { variant?: 'success' | 'error' | 'info' }) {
  const { toast } = useToast();
  return <button onClick={() => toast('Test message', variant)}>Show Toast</button>;
}

function setup(variant?: 'success' | 'error' | 'info') {
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
    expect(screen.getByRole('alert')).toHaveClass('bg-green-50');
  });

  it('renders error variant', () => {
    setup('error');
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toHaveClass('bg-red-50');
  });

  it('renders info variant', () => {
    setup('info');
    fireEvent.click(screen.getByText('Show Toast'));
    expect(screen.getByRole('alert')).toHaveClass('bg-blue-50');
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
});
