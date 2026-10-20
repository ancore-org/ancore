import { type ReactNode, type TouchEvent, useRef, useState } from 'react';

type Props = {
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  /**
   * Platform identifier for conditional rendering.
   * - 'web': uses touch events for pull-to-refresh
   * - 'native': consumer should use RefreshControl directly with FlatList
   */
  platform?: 'web' | 'native';
};

const PULL_THRESHOLD_PX = 48;

export const PullToRefreshControl = ({ 
  isRefreshing, 
  onRefresh, 
  children,
  platform = 'web',
}: Props) => {
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);

  // On React Native, the parent should use RefreshControl directly with FlatList
  // This component only provides the web touch implementation
  if (platform === 'native') {
    return <>{children}</>;
  }

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
