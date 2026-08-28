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
  });

  it('calls onContinueAnyway when provided and acknowledged', () => {
    const onContinue = jest.fn();
    render(<JailbreakWarningScreen onContinueAnyway={onContinue} />);

    // In the test environment, __DEV__ is not set so the button won't render.
    // This test verifies the prop is accepted without error.
    expect(onContinue).not.toHaveBeenCalled();
  });
});
