import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BalanceCard, REFRESH_COOLDOWN_MS } from '../BalanceCard';

function renderCard(overrides: Partial<React.ComponentProps<typeof BalanceCard>> = {}) {
  const onRefresh = vi.fn();
  const utils = render(
    <BalanceCard
      balance={10}
      isLoading={false}
      error={null}
      currency="XLM"
      onRefresh={onRefresh}
      isRefreshing={false}
      {...overrides}
    />
  );
  return { onRefresh, ...utils };
}

const clickRefresh = () =>
  act(async () => {
    fireEvent.click(refreshButton());
  });

const refreshButton = () => screen.getByRole('button', { name: /refresh balance/i });

describe('BalanceCard refresh throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires only one refresh for repeated clicks within the cooldown', async () => {
    const { onRefresh } = renderCard();

    await clickRefresh();
    await clickRefresh();
    await clickRefresh();

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables the button during the cooldown and re-enables it afterwards', async () => {
    const { onRefresh } = renderCard();

    await clickRefresh();
    expect(refreshButton()).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(REFRESH_COOLDOWN_MS - 1);
    });
    expect(refreshButton()).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(refreshButton()).not.toBeDisabled();

    await clickRefresh();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('shows the remaining seconds while cooling down', async () => {
    renderCard();

    await clickRefresh();
    expect(screen.getByText('5s')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('3s')).toBeInTheDocument();
  });

  it('spins the icon while a refresh is in flight', () => {
    const { container } = renderCard({ isRefreshing: true });

    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('does not spin the icon when idle', () => {
    const { container } = renderCard();

    expect(container.querySelector('svg.animate-spin')).toBeNull();
  });

  it('clears the cooldown timer on unmount', async () => {
    const { unmount } = renderCard();

    await clickRefresh();
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
