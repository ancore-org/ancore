import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { NetworkBadge } from '../NetworkBadge';
import { useSettingsStore, DEFAULTS } from '@/stores/settings';

describe('NetworkBadge', () => {
  beforeEach(() => {
    useSettingsStore.setState(DEFAULTS);
  });

  it('renders TESTNET with yellow/amber color styling', () => {
    render(<NetworkBadge network="testnet" />);
    const badge = screen.getByTestId('network-badge');

    expect(badge.textContent).toContain('TESTNET');
    expect(badge.className).toContain('text-amber-400');
    expect(badge.getAttribute('data-network')).toBe('testnet');

    const dot = screen.getByTestId('network-dot');
    expect(dot.className).toContain('bg-amber-400');
  });

  it('renders MAINNET with green/emerald color styling', () => {
    render(<NetworkBadge network="mainnet" />);
    const badge = screen.getByTestId('network-badge');

    expect(badge.textContent).toContain('MAINNET');
    expect(badge.className).toContain('text-emerald-400');
    expect(badge.getAttribute('data-network')).toBe('mainnet');

    const dot = screen.getByTestId('network-dot');
    expect(dot.className).toContain('bg-emerald-400');
  });

  it('renders FUTURENET with purple color styling', () => {
    render(<NetworkBadge network="futurenet" />);
    const badge = screen.getByTestId('network-badge');

    expect(badge.textContent).toContain('FUTURENET');
    expect(badge.className).toContain('text-purple-400');
    expect(badge.getAttribute('data-network')).toBe('futurenet');

    const dot = screen.getByTestId('network-dot');
    expect(dot.className).toContain('bg-purple-400');
  });

  it('falls back to active network from useSettingsStore when prop is omitted', () => {
    useSettingsStore.setState({ ...DEFAULTS, network: 'mainnet' });
    render(<NetworkBadge />);

    const badge = screen.getByTestId('network-badge');
    expect(badge.textContent).toContain('MAINNET');
    expect(badge.getAttribute('data-network')).toBe('mainnet');
  });
});
