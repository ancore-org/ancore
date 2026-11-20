/* eslint-disable no-script-url */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GrantAccessScreen } from '../GrantAccessScreen';

describe('GrantAccessScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sanitized dApp metadata, stripping XSS script tags and markup', () => {
    render(
      <GrantAccessScreen
        requestId="req-123"
        dappName="Malicious<script>alert('xss')</script> App"
        origin="https://safe.stellar.org<img src=x onerror=alert(1)>"
        description="Connect your account <b>securely</b><script>fetch('evil.com')</script>"
      />
    );

    const nameEl = screen.getByTestId('dapp-name');
    expect(nameEl.textContent).toBe('Malicious App');
    expect(nameEl.innerHTML).not.toContain('<script>');

    const originEl = screen.getByTestId('dapp-origin');
    expect(originEl.textContent).toContain('https://safe.stellar.org');
    expect(originEl.innerHTML).not.toContain('onerror');

    const descEl = screen.getByTestId('dapp-description');
    expect(descEl.textContent).toBe('Connect your account securely');
    expect(descEl.innerHTML).not.toContain('<script>');
  });

  it('neutralizes javascript: icon URLs', () => {
    const { container } = render(
      <GrantAccessScreen
        requestId="req-456"
        dappName="Untrusted App"
        iconUrl="javascript:alert(1)"
      />
    );

    const img = container.querySelector('img');
    expect(img).toBeNull();
  });

  it('invokes approve callback when Connect button is clicked', () => {
    const onApprove = vi.fn();
    render(
      <GrantAccessScreen requestId="req-789" dappName="Stellar Portal" onApprove={onApprove} />
    );

    const connectBtn = screen.getByTestId('approve-access-btn');
    fireEvent.click(connectBtn);
    expect(onApprove).toHaveBeenCalled();
  });

  it('invokes reject callback when Cancel button is clicked', () => {
    const onReject = vi.fn();
    render(<GrantAccessScreen requestId="req-789" dappName="Stellar Portal" onReject={onReject} />);

    const cancelBtn = screen.getByTestId('reject-access-btn');
    fireEvent.click(cancelBtn);
    expect(onReject).toHaveBeenCalled();
  });
});
