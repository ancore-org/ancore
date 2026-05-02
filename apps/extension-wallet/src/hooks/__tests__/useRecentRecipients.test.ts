import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRecentRecipients } from '../useRecentRecipients';

const mockGetRecentRecipients = vi.fn();
const mockSaveRecentRecipients = vi.fn();

vi.mock('@ancore/core-sdk', () => ({
  SecureStorageManager: class {
    get isUnlocked() {
      return true;
    }
    getRecentRecipients = mockGetRecentRecipients;
    saveRecentRecipients = mockSaveRecentRecipients;
  },
  createStorageAdapter: () => ({}),
}));

describe('useRecentRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecentRecipients.mockResolvedValue({ recipients: [] });
  });

  it('loads recipients on mount', async () => {
    mockGetRecentRecipients.mockResolvedValue({
      recipients: [{ address: 'G123', timestamp: 100 }],
    });

    const { result } = renderHook(() => useRecentRecipients());

    // Wait for useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.recipients).toHaveLength(1);
    expect(result.current.recipients[0].address).toBe('G123');
  });

  it('adds new recipients and limits to 5', async () => {
    mockGetRecentRecipients.mockResolvedValue({ recipients: [] });

    const { result } = renderHook(() => useRecentRecipients());

    await act(async () => {
      await result.current.addRecipient({ address: 'G1' });
      await result.current.addRecipient({ address: 'G2' });
      await result.current.addRecipient({ address: 'G3' });
      await result.current.addRecipient({ address: 'G4' });
      await result.current.addRecipient({ address: 'G5' });
    });

    expect(result.current.recipients).toHaveLength(5);
    expect(result.current.recipients[0].address).toBe('G5');

    // Add a 6th one
    mockGetRecentRecipients.mockResolvedValue({ recipients: result.current.recipients });
    await act(async () => {
      await result.current.addRecipient({ address: 'G6' });
    });

    expect(result.current.recipients).toHaveLength(5);
    expect(result.current.recipients[0].address).toBe('G6');
    expect(mockSaveRecentRecipients).toHaveBeenCalled();
  });

  it('excludes duplicates and moves existing to top', async () => {
    mockGetRecentRecipients.mockResolvedValue({
      recipients: [
        { address: 'G1', timestamp: 100 },
        { address: 'G2', timestamp: 200 },
      ],
    });

    const { result } = renderHook(() => useRecentRecipients());

    // Wait for load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.addRecipient({ address: 'G1' });
    });

    expect(result.current.recipients).toHaveLength(2);
    expect(result.current.recipients[0].address).toBe('G1');
    expect(result.current.recipients[0].timestamp).toBeGreaterThan(100);
  });
});
