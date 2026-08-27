import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useRecentRecipients } from '../useRecentRecipients';

const mockGetRecentRecipients = vi.fn();
const mockSaveRecentRecipients = vi.fn();

const ADDR_A = 'GDP27GNQUPVJQ2JRZC5N5YYNLMKNVYF5AJOOKWQ2R4PKAKMMV77O5EIY';
const ADDR_B = 'GDX7IBH35QYGRVFKSXXYINHDQSKV7SRZ7EFVYYI4USSK66BRSZWDVE5C';
const ADDR_C = 'GBSDPCBQDSTOCIOOXLYOHF5BYZTRI2MHINMYBJZEVGQ6Y5NNXUIVO6F4';
const ADDR_D = 'GCW6ITSG3JSTKQ2RHAJCIZTZDK3RTY6L2B6CVRQ4BJS3E6MSIJ3NWC2K';
const ADDR_E = 'GBCAZIJKQQ7PM3IPOY6XEUA55HSTYASZPEEGRFYTUQWIYBKEPR7EF4KD';
const ADDR_F = 'GA56YCHZ4S5RP2IBJ5MPARIN2TGV4RZMY6C26OTLXPQLRXPBK6YS4KF4';

vi.mock('@ancore/core-sdk', async () => {
  const actual = await vi.importActual<typeof import('@ancore/core-sdk')>('@ancore/core-sdk');
  return {
    ...actual,
    ChromeStorageAdapter: class {},
    SecureStorageManager: class {
      get isUnlocked() {
        return true;
      }
      getRecentRecipients = mockGetRecentRecipients;
      saveRecentRecipients = mockSaveRecentRecipients;
    },
  };
});

describe('useRecentRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecentRecipients.mockResolvedValue({ recipients: [] });
  });

  it('loads recipients on mount', async () => {
    mockGetRecentRecipients.mockResolvedValue({
      recipients: [{ address: ADDR_A, timestamp: 100 }],
    });

    const { result } = renderHook(() => useRecentRecipients());

    // Wait for useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.recipients).toHaveLength(1);
    expect(result.current.recipients[0].address).toBe(ADDR_A);
  });

  it('adds new recipients and limits to 5', async () => {
    mockGetRecentRecipients.mockResolvedValue({ recipients: [] });

    const { result } = renderHook(() => useRecentRecipients());

    await act(async () => {
      await result.current.addRecipient({ address: ADDR_A });
      await result.current.addRecipient({ address: ADDR_B });
      await result.current.addRecipient({ address: ADDR_C });
      await result.current.addRecipient({ address: ADDR_D });
      await result.current.addRecipient({ address: ADDR_E });
    });

    expect(result.current.recipients).toHaveLength(5);
    expect(result.current.recipients[0].address).toBe(ADDR_E);

    // Add a 6th one
    mockGetRecentRecipients.mockResolvedValue({ recipients: result.current.recipients });
    await act(async () => {
      await result.current.addRecipient({ address: ADDR_F });
    });

    expect(result.current.recipients).toHaveLength(5);
    expect(result.current.recipients[0].address).toBe(ADDR_F);
    expect(mockSaveRecentRecipients).toHaveBeenCalled();
  });

  it('excludes duplicates and moves existing to top', async () => {
    mockGetRecentRecipients.mockResolvedValue({
      recipients: [
        { address: ADDR_A, timestamp: 100 },
        { address: ADDR_B, timestamp: 200 },
      ],
    });

    const { result } = renderHook(() => useRecentRecipients());

    // Wait for load
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      await result.current.addRecipient({ address: ADDR_A });
    });

    expect(result.current.recipients).toHaveLength(2);
    expect(result.current.recipients[0].address).toBe(ADDR_A);
    expect(result.current.recipients[0].timestamp).toBeGreaterThan(100);
  });
});
