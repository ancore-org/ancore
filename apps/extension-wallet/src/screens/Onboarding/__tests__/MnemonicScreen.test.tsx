import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MnemonicScreen } from '../MnemonicScreen';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('MnemonicScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders every mnemonic word', () => {
    render(<MnemonicScreen mnemonic={MNEMONIC} onNext={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('about')).toBeInTheDocument();
    expect(screen.getAllByText('abandon')).toHaveLength(11);
  });

  it('zero-fills the word array on unmount', () => {
    const fillSpy = vi.spyOn(Array.prototype, 'fill');
    const { unmount } = render(
      <MnemonicScreen mnemonic={MNEMONIC} onNext={vi.fn()} onBack={vi.fn()} />
    );

    expect(fillSpy).not.toHaveBeenCalledWith('');
    unmount();

    const wordFill = fillSpy.mock.calls.findIndex(([value]) => value === '');
    expect(wordFill).toBeGreaterThanOrEqual(0);
    const filled = fillSpy.mock.contexts[wordFill] as string[];
    expect(filled).toHaveLength(12);
    expect(filled.every((word) => word === '')).toBe(true);
  });
});
