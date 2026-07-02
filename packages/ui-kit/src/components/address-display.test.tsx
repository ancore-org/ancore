import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { AddressDisplay } from './address-display';

const sampleAddress = 'GCZJM35NKGVK47BB4SPBDV25477PZYIYPVVG453LPYFNXLS3FGHDXOCM';

describe('AddressDisplay', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  // ─── Truncation ──────────────────────────────────────────────────────────

  it('renders address with default truncation', () => {
    render(<AddressDisplay address={sampleAddress} />);
    expect(screen.getByText(/GCZJM3...HDXOCM/)).toBeInTheDocument();
  });

  it('renders full short addresses without truncation', () => {
    render(<AddressDisplay address="SHORT" />);
    // The tooltip duplicates the content, so query the <code> element specifically
    const code = document.querySelector('code');
    expect(code).toHaveTextContent('SHORT');
  });

  it('respects custom truncation length', () => {
    render(<AddressDisplay address={sampleAddress} truncate={10} />);
    expect(screen.getByText(/GCZJM35NKG...S3FGHDXOCM/)).toBeInTheDocument();
  });

  // ─── Label ───────────────────────────────────────────────────────────────

  it('renders label when provided', () => {
    render(<AddressDisplay address={sampleAddress} label="Wallet Address" />);
    expect(screen.getByText('Wallet Address')).toBeInTheDocument();
  });

  it('does not render a label element when omitted', () => {
    const { container } = render(<AddressDisplay address={sampleAddress} />);
    expect(container.querySelector('label')).toBeNull();
  });

  // ─── Copy button ─────────────────────────────────────────────────────────

  it('renders copy button by default', () => {
    render(<AddressDisplay address={sampleAddress} />);
    expect(screen.getByLabelText('Copy address')).toBeInTheDocument();
  });

  it('hides copy button when copyable is false', () => {
    render(<AddressDisplay address={sampleAddress} copyable={false} />);
    expect(screen.queryByLabelText('Copy address')).not.toBeInTheDocument();
  });

  it('copies full address to clipboard on click', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    render(<AddressDisplay address={sampleAddress} />);
    await user.click(screen.getByLabelText('Copy address'));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(sampleAddress);
    });
  });

  it('updates aria-label to "Copied!" after clicking', async () => {
    const user = userEvent.setup();
    render(<AddressDisplay address={sampleAddress} />);

    await user.click(screen.getByLabelText('Copy address'));

    await waitFor(() => {
      expect(screen.getByLabelText('Copied!')).toBeInTheDocument();
    });
  });

  it('announces copy to screen readers via aria-live region', async () => {
    const user = userEvent.setup();
    render(<AddressDisplay address={sampleAddress} />);

    await user.click(screen.getByLabelText('Copy address'));

    await waitFor(() => {
      expect(screen.getByText('Address copied to clipboard')).toBeInTheDocument();
    });
  });

  it('calls custom onCopy handler instead of clipboard when provided', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    render(<AddressDisplay address={sampleAddress} onCopy={onCopy} />);
    await user.click(screen.getByLabelText('Copy address'));

    expect(onCopy).toHaveBeenCalledOnce();
    expect(writeTextSpy).not.toHaveBeenCalled();
  });

  it('respects controlled copied prop', () => {
    render(<AddressDisplay address={sampleAddress} copied={true} />);
    expect(screen.getByLabelText('Copied!')).toBeInTheDocument();
  });

  // ─── Tooltip (full address on hover) ─────────────────────────────────────

  it('renders the full address in the tooltip content', () => {
    const { container } = render(<AddressDisplay address={sampleAddress} />);
    // The Tooltip renders the full address in a div inside .group
    expect(container.textContent).toContain(sampleAddress);
  });

  it('exposes the full address via aria-label on the code element', () => {
    render(<AddressDisplay address={sampleAddress} />);
    expect(screen.getByLabelText(`Address: ${sampleAddress}`)).toBeInTheDocument();
  });

  // ─── Identicon ───────────────────────────────────────────────────────────

  it('does not render identicon by default', () => {
    render(<AddressDisplay address={sampleAddress} />);
    // Identicon renders as an <svg role="img">; there should be none by default
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders identicon when showIdenticon is true', () => {
    render(<AddressDisplay address={sampleAddress} showIdenticon />);
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  // ─── Validation feedback ─────────────────────────────────────────────────

  it('shows no validation indicator by default (isValid undefined)', () => {
    render(<AddressDisplay address={sampleAddress} />);
    expect(screen.queryByLabelText('Invalid address')).not.toBeInTheDocument();
  });

  it('shows no validation indicator when isValid is true', () => {
    render(<AddressDisplay address={sampleAddress} isValid={true} />);
    expect(screen.queryByLabelText('Invalid address')).not.toBeInTheDocument();
  });

  it('shows AlertCircle icon when isValid is false', () => {
    render(<AddressDisplay address={sampleAddress} isValid={false} />);
    expect(screen.getByLabelText('Invalid address')).toBeInTheDocument();
  });

  it('applies destructive border class when isValid is false', () => {
    const { container } = render(<AddressDisplay address={sampleAddress} isValid={false} />);
    // The inner row div should carry the destructive border class
    const row = container.querySelector('.border-destructive');
    expect(row).toBeInTheDocument();
  });

  it('applies normal border class when isValid is true', () => {
    const { container } = render(<AddressDisplay address={sampleAddress} isValid={true} />);
    const row = container.querySelector('.border-input');
    expect(row).toBeInTheDocument();
  });

  // ─── className passthrough ────────────────────────────────────────────────

  it('merges custom className', () => {
    const { container } = render(
      <AddressDisplay address={sampleAddress} className="my-custom-class" />
    );
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});
