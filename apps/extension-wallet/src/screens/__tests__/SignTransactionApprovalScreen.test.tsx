import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SignTransactionApprovalScreen } from '@/screens/SignTransactionApprovalScreen';

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('@/stores/hardware-wallet', () => ({
  useHardwareWalletStore: (
    sel: (s: { signerMode: string; ledgerPublicKey: string | null }) => unknown
  ) => sel({ signerMode: 'software', ledgerPublicKey: null }),
}));

const sendMessageMock = vi.fn((_msg, cb) => cb && cb());

beforeEach(() => {
  sendMessageMock.mockClear();
  Object.defineProperty(globalThis, 'chrome', {
    value: { runtime: { sendMessage: sendMessageMock } },
    writable: true,
    configurable: true,
  });
});

describe('SignTransactionApprovalScreen keyboard behaviour', () => {
  it('auto-focuses the Approve button on mount', () => {
    render(<SignTransactionApprovalScreen requestId="req-1" />);
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveFocus();
  });

  it('sends REJECT_SIGN_REQUEST when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(<SignTransactionApprovalScreen requestId="req-2" />);
    await user.keyboard('{Escape}');
    expect(sendMessageMock).toHaveBeenCalledWith(
      { type: 'REJECT_SIGN_REQUEST', requestId: 'req-2' },
      expect.any(Function)
    );
  });

  it('does not send reject when Escape is pressed while submitting', async () => {
    const user = userEvent.setup();
    // Stall sendMessage so submitting stays true
    sendMessageMock.mockImplementation(() => {});
    render(<SignTransactionApprovalScreen requestId="req-3" />);
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    sendMessageMock.mockClear();
    await user.keyboard('{Escape}');
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
