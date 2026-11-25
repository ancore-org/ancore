import { act, render } from '@testing-library/react';
import type { GestureResponderEvent } from 'react-native';

import { PullToRefreshControl } from '../PullToRefreshControl';

type TouchHandlers = {
  onTouchStart: (event: GestureResponderEvent | TouchEvent) => void;
  onTouchMove: (event: GestureResponderEvent | TouchEvent) => void;
};

describe('PullToRefreshControl', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['native', (y: number): GestureResponderEvent => ({ nativeEvent: { pageY: y } })],
    [
      'DOM',
      (y: number): TouchEvent =>
        Object.defineProperty(new TouchEvent('touchmove'), 'touches', {
          value: [{ clientY: y }],
        }),
    ],
  ] as const)('clamps the pull distance for %s touch events', (_shape, eventAt) => {
    const setPullDistance = jest.fn();
    const react = jest.requireActual<typeof import('react')>('react');
    jest.spyOn(react, 'useState').mockImplementationOnce(() => [0, setPullDistance]);

    const native = jest.requireMock<{ View: (props: TouchHandlers) => null }>('react-native');
    const view = jest.spyOn(native, 'View').mockReturnValue(null);
    render(
      <PullToRefreshControl isRefreshing={false} onRefresh={jest.fn()}>
        {null}
      </PullToRefreshControl>
    );

    const { onTouchStart, onTouchMove } = view.mock.calls[0]![0];
    act(() => {
      onTouchStart(eventAt(10));
      onTouchMove(eventAt(30));
      onTouchMove(eventAt(100));
      onTouchMove(new TouchEvent('touchmove'));
    });

    expect(setPullDistance.mock.calls).toEqual([[20], [48]]);
  });
});
