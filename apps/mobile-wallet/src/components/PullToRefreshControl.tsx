import { type ReactNode, type TouchEvent, useRef, useState } from 'react';

type Props = {
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
};

const PULL_THRESHOLD_PX = 48;

export const PullToRefreshControl = ({ isRefreshing, onRefresh, children }: Props) => {
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  const isPulling = pullDistance > 0 && !isRefreshing;
  const shouldShowIndicator = isPulling || isRefreshing;

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    startYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (startYRef.current === null || isRefreshing) {
      return;
    }

    const nextY = event.touches[0]?.clientY ?? startYRef.current;
    setPullDistance(Math.max(0, Math.min(nextY - startYRef.current, PULL_THRESHOLD_PX)));
  };

  const handleTouchEnd = () => {
    const shouldRefresh = pullDistance >= PULL_THRESHOLD_PX;

    startYRef.current = null;
    setPullDistance(0);

    if (shouldRefresh && !isRefreshing) {
      void onRefresh();
    }
  };

  return (
    <section
      data-testid="pull-to-refresh"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {shouldShowIndicator ? (
        <p aria-live="polite" role="status">
          {isRefreshing ? 'Refreshing transactions...' : 'Release to refresh'}
        </p>
      ) : null}
      {children}
    </section>
  );
};
