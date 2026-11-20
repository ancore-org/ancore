/* eslint-disable no-script-url */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignTransactionApprovalScreen } from '../SignTransactionApprovalScreen';
import { MemoryRouter } from 'react-router-dom';

describe('SignTransactionApprovalScreen', () => {
  let sendMessageMock: any;

  beforeEach(() => {
    vi.resetAllMocks();
    sendMessageMock = vi.fn((msg, cb) => cb?.());
    (globalThis as any).chrome = {
      runtime: {
        sendMessage: sendMessageMock,
      },
    };
  });

  it('renders sanitized title, subtitle, and description preventing HTML/script injection', () => {
    render(
      <MemoryRouter>
        <SignTransactionApprovalScreen
          requestId="req-123"
          title="<script>alert(1)</script>Sign"
          subtitle="<img src=x onerror=alert(1)>Review"
          description="Click <a href='javascript:void(0)'>here</a>"
        />
      </MemoryRouter>
    );

    // Assert that malicious markup is escaped in text content
    expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/&lt;script&gt;alert\(1\)&lt;&#x2F;script&gt;Sign/)
    ).toBeInTheDocument();
    expect(screen.getByText(/&lt;img src=x onerror=alert\(1\)&gt;Review/)).toBeInTheDocument();
  });

  it('renders sanitized origin and contract metadata safely', () => {
    render(
      <MemoryRouter>
        <SignTransactionApprovalScreen
          requestId="req-456"
          origin="javascript:alert(1)"
          dAppName="<script>Evil</script>Swap"
          contractId="<script>bad</script>"
          methodName="<img src=x>execute"
          requestedScopes={['read_user', '<script>steal</script>']}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Untrusted origin/)).toBeInTheDocument();
    expect(screen.getByText(/Invalid Contract Address/)).toBeInTheDocument();
    expect(screen.getByText(/&lt;script&gt;steal&lt;&#x2F;script&gt;/)).toBeInTheDocument();
  });

  it('sends APPROVE_SIGN_REQUEST to background on approve click', () => {
    render(
      <MemoryRouter>
        <SignTransactionApprovalScreen requestId="req-789" />
      </MemoryRouter>
    );

    const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    expect(sendMessageMock).toHaveBeenCalledWith(
      { type: 'APPROVE_SIGN_REQUEST', requestId: 'req-789' },
      expect.any(Function)
    );
  });

  it('sends REJECT_SIGN_REQUEST to background on reject click', () => {
    render(
      <MemoryRouter>
        <SignTransactionApprovalScreen requestId="req-789" />
      </MemoryRouter>
    );

    const rejectBtn = screen.getByRole('button', { name: /^Reject$/i });
    fireEvent.click(rejectBtn);

    expect(sendMessageMock).toHaveBeenCalledWith(
      { type: 'REJECT_SIGN_REQUEST', requestId: 'req-789' },
      expect.any(Function)
    );
  });

  it('sends APPROVE_AUTH_ENTRY_REQUEST when requestType is sign-auth-entry', () => {
    render(
      <MemoryRouter>
        <SignTransactionApprovalScreen requestId="req-auth-1" requestType="sign-auth-entry" />
      </MemoryRouter>
    );

    const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    expect(sendMessageMock).toHaveBeenCalledWith(
      { type: 'APPROVE_AUTH_ENTRY_REQUEST', requestId: 'req-auth-1' },
      expect.any(Function)
    );
  });
});
