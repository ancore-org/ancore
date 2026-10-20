import { type ReactNode, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GestureResponderEvent } from 'react-native';

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

  const handleTouchStart = (event: GestureResponderEvent) => {
    const anyEvent = event as any;
    const nativeEvent = anyEvent?.nativeEvent ?? anyEvent;
    startYRef.current =
      nativeEvent?.pageY ??
      anyEvent?.touches?.[0]?.clientY ??
      nativeEvent?.touches?.[0]?.clientY ??
      null;
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (startYRef.current === null || isRefreshing) {
      return;
    }

    const anyEvent = event as any;
    const nativeEvent = anyEvent?.nativeEvent ?? anyEvent;
    const nextY =
      nativeEvent?.pageY ??
      anyEvent?.touches?.[0]?.clientY ??
      nativeEvent?.touches?.[0]?.clientY ??
      startYRef.current;
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
    <View
      testID="pull-to-refresh"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {shouldShowIndicator ? (
        <Text style={styles.indicator} accessibilityLiveRegion="polite" accessibilityRole="status">
          {isRefreshing ? 'Refreshing transactions...' : 'Release to refresh'}
        </Text>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  indicator: {
    padding: 12,
    textAlign: 'center',
    fontSize: 14,
    color: '#64748b',
  },
});
