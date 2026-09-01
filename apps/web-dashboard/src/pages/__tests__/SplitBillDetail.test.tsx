import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SplitBillDetail } from '../SplitBillDetail';
import type { SplitBill } from '../../types/split-bill';

const mockUpdateParticipant = vi.fn();
const mockCancelBill = vi.fn();
let mockCurrentAccount: { address: string } | null = null;
let mockBillData: SplitBill | undefined = undefined;

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'bill-123' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/useAccountState', () => ({
  useAccountState: () => ({
    currentAccount: mockCurrentAccount,
  }),
}));

vi.mock('../../hooks/useSplitBill', () => ({
  useSplitBill: () => ({
    getBill: () => mockBillData,
    updateParticipant: mockUpdateParticipant,
    cancelBill: mockCancelBill,
    bills: [],
    isLoading: false,
    createBill: vi.fn(),
  }),
}));

const CREATOR_ADDR = 'GCREATOR123456789012345678901234567890123456789012345678';
const PARTICIPANT_ADDR = 'GPARTICIPANT123456789012345678901234567890123456789012345';
const STRANGER_ADDR = 'GSTRANGER123456789012345678901234567890123456789012345678';

describe('SplitBillDetail authorization and verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentAccount = null;
    mockBillData = {
      id: 'bill-123',
      title: 'Weekend Trip',
      creatorAddress: CREATOR_ADDR,
      status: 'open',
      createdAt: 1700000000000,
      expiresAt: 1700086400000,
      updatedAt: 1700000000000,
      participants: [
        {
          id: 'part-1',
          address: PARTICIPANT_ADDR,
          alias: 'Alice',
          amount: '50',
          assetCode: 'XLM',
          status: 'pending',
        },
      ],
    };
  });

  it('renders "Pending verification" and hides action buttons when viewer is neither participant nor creator', () => {
    mockCurrentAccount = { address: STRANGER_ADDR };
    render(<SplitBillDetail />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark paid/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /mark failed/i })).not.toBeInTheDocument();
  });

  it('allows participant to self-verify and mark payment with transaction hash', async () => {
    const user = userEvent.setup();
    mockCurrentAccount = { address: PARTICIPANT_ADDR };
    render(<SplitBillDetail />);

    const markPaidBtn = screen.getByRole('button', { name: /mark paid/i });
    expect(markPaidBtn).toBeInTheDocument();
    await user.click(markPaidBtn);

    expect(screen.getByText(/confirm payment verification/i)).toBeInTheDocument();
    const hashInput = screen.getByPlaceholderText(/transaction hash/i);
    await user.type(hashInput, 'TX_HASH_XYZ_987654321');

    await user.click(screen.getByRole('button', { name: /confirm paid/i }));

    expect(mockUpdateParticipant).toHaveBeenCalledWith('bill-123', 'part-1', 'paid', {
      txHash: 'TX_HASH_XYZ_987654321',
    });
  });

  it('allows creator to mark participant payment as failed with reason', async () => {
    const user = userEvent.setup();
    mockCurrentAccount = { address: CREATOR_ADDR };
    render(<SplitBillDetail />);

    const markFailedBtn = screen.getByRole('button', { name: /mark failed/i });
    expect(markFailedBtn).toBeInTheDocument();
    await user.click(markFailedBtn);

    expect(screen.getByText(/record payment failure/i)).toBeInTheDocument();
    const reasonInput = screen.getByPlaceholderText(/failure reason/i);
    await user.type(reasonInput, 'Transaction was declined by network');

    await user.click(screen.getByRole('button', { name: /confirm failed/i }));

    expect(mockUpdateParticipant).toHaveBeenCalledWith('bill-123', 'part-1', 'failed', {
      failedReason: 'Transaction was declined by network',
    });
  });

  it('displays recorded txHash on a paid participant', () => {
    mockBillData = {
      ...mockBillData!,
      status: 'completed',
      participants: [
        {
          id: 'part-1',
          address: PARTICIPANT_ADDR,
          alias: 'Alice',
          amount: '50',
          assetCode: 'XLM',
          status: 'paid',
          paidAt: 1700005000000,
          txHash: 'ABCDEF1234567890FEDCBA',
        },
      ],
    };

    render(<SplitBillDetail />);
    expect(screen.getByText(/tx: ABCDEF12…FEDCBA/i)).toBeInTheDocument();
  });
});
