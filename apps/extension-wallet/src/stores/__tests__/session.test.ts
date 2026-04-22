import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../session';

beforeEach(() => {
  useSessionStore.setState({ currentRoute: 'home', status: 'locked', lastActiveAt: null });
});

describe('useSessionStore', () => {
  it('starts locked on home route', () => {
    const { currentRoute, status } = useSessionStore.getState();
    expect(currentRoute).toBe('home');
    expect(status).toBe('locked');
  });

  it('navigates to a route', () => {
    useSessionStore.getState().navigate('settings');
    const { currentRoute, lastActiveAt } = useSessionStore.getState();
    expect(currentRoute).toBe('settings');
    expect(lastActiveAt).not.toBeNull();
  });

  it('sets status', () => {
    useSessionStore.getState().setStatus('ready');
    expect(useSessionStore.getState().status).toBe('ready');
  });

  it('touch updates lastActiveAt', () => {
    useSessionStore.getState().touch();
    expect(useSessionStore.getState().lastActiveAt).not.toBeNull();
  });
});
