import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { HistoryList } from '../HistoryList';

describe('HistoryList', () => {
  it('renders empty state graphic and helpful copy when items array is empty and !isLoading', () => {
    const onReceive = vi.fn();
    render(<HistoryList items={[]} isLoading={false} onReceive={onReceive} />);

    expect(screen.getByTestId('empty-activity-state')).toBeDefined();
    expect(screen.getByText('No transactions yet')).toBeDefined();
    expect(
      screen.getByText(
        'Your transaction activity will appear here once you send or receive assets.'
      )
    ).toBeDefined();

    const receiveBtn = screen.getByTestId('receive-cta-btn');
    expect(receiveBtn).toBeDefined();
    expect(receiveBtn.textContent).toContain('Receive');

    fireEvent.click(receiveBtn);
    expect(onReceive).toHaveBeenCalledOnce();
  });

  it('does not render empty state while history is loading', () => {
    render(<HistoryList items={[]} isLoading={true} />);

    expect(screen.queryByTestId('empty-activity-state')).toBeNull();
    expect(screen.getByTestId('history-loading')).toBeDefined();
  });

  it('renders list items when transactions exist', () => {
    const sampleItems = [
      { id: 'tx-1', amount: '10 XLM', label: 'Payment received', kind: 'received' },
      { id: 'tx-2', amount: '2.5 XLM', label: 'Payment sent', kind: 'sent' },
    ];

    render(<HistoryList items={sampleItems} isLoading={false} />);

    expect(screen.queryByTestId('empty-activity-state')).toBeNull();
    expect(screen.getByText('Payment received')).toBeDefined();
    expect(screen.getByText('Payment sent')).toBeDefined();
    expect(screen.getByText('10 XLM')).toBeDefined();
    expect(screen.getByText('2.5 XLM')).toBeDefined();
  });
});
