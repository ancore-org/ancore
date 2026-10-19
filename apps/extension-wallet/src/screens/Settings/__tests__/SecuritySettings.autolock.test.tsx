import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecuritySettings } from '../SecuritySettings';

describe('SecuritySettings — custom auto-lock duration validator (#1452, #1454)', () => {
  const defaultProps = {
    autoLockTimeout: 15,
    onAutoLockChange: vi.fn(),
    requirePasswordForSensitiveActions: true,
    onRequirePasswordForSensitiveActionsChange: vi.fn(),
    enableLockShortcut: true,
    onEnableLockShortcutChange: vi.fn(),
    onBack: vi.fn(),
  };

  it('navigates to auto-lock view and displays custom duration input', async () => {
    render(<SecuritySettings {...defaultProps} />);
    await userEvent.click(screen.getByText('Auto-lock Timeout'));

    expect(screen.getByText('Custom Duration (Minutes)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 60')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('accepts and applies a valid custom auto-lock duration', async () => {
    const onAutoLockChange = vi.fn();
    render(<SecuritySettings {...defaultProps} onAutoLockChange={onAutoLockChange} />);

    await userEvent.click(screen.getByText('Auto-lock Timeout'));
    const input = screen.getByPlaceholderText('e.g. 60');
    await userEvent.type(input, '45');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAutoLockChange).toHaveBeenCalledWith(45);
  });

  it('rejects duration outside the 1-1440 range and displays error message', async () => {
    const onAutoLockChange = vi.fn();
    render(<SecuritySettings {...defaultProps} onAutoLockChange={onAutoLockChange} />);

    await userEvent.click(screen.getByText('Auto-lock Timeout'));
    const input = screen.getByPlaceholderText('e.g. 60');

    // Test 0
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      screen.getByText(/Duration must be a whole number between 1 and 1440 minutes/i),
    ).toBeInTheDocument();
    expect(onAutoLockChange).not.toHaveBeenCalled();

    // Test > 1440
    await userEvent.clear(input);
    await userEvent.type(input, '1441');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      screen.getByText(/Duration must be a whole number between 1 and 1440 minutes/i),
    ).toBeInTheDocument();
    expect(onAutoLockChange).not.toHaveBeenCalled();
  });
});
