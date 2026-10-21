import { render, screen } from '@testing-library/react';

import { JailbreakWarningScreen } from '../JailbreakWarningScreen';

describe('JailbreakWarningScreen', () => {
  it('renders the security warning heading', () => {
    render(<JailbreakWarningScreen />);

    expect(screen.getByText('Security Warning')).toBeDefined();
  });

  it('explains why jailbroken devices are blocked', () => {
    render(<JailbreakWarningScreen />);

    expect(screen.getByText(/jailbroken or rooted/i)).toBeDefined();
    expect(screen.getByText(/expose your private keys/i)).toBeDefined();
  });

  it('does not show "Continue anyway" in production mode', () => {
    render(<JailbreakWarningScreen />);

    expect(screen.queryByRole('button', { name: /continue anyway/i })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('displays warning about keychain and secure storage risks', () => {
    render(<JailbreakWarningScreen />);

    expect(screen.getByText(/Keychain/i)).toBeDefined();
    expect(screen.getByText(/secure storage/i)).toBeDefined();
  });

  it('accepts onContinueAnyway callback without error', () => {
    const onContinue = jest.fn();
    render(<JailbreakWarningScreen onContinueAnyway={onContinue} />);

    // In production mode (default in tests), the button won't render,
    // but the component should accept the prop without error
    expect(onContinue).not.toHaveBeenCalled();
  });
});
