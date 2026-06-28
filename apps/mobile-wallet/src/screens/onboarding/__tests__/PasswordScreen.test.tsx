import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';

import { PasswordScreen } from '../PasswordScreen';

jest.mock('@ancore/crypto', () => {
  const actual = jest.requireActual('@ancore/crypto');
  return {
    ...actual,
    validatePasswordStrength: jest.fn((password: string) => {
      if (password.length < 8) {
        return {
          valid: false,
          strength: 'weak' as const,
          reasons: ['Password must be at least 12 characters long.'],
        };
      }
      if (password === 'weakpassword1') {
        return {
          valid: false,
          strength: 'weak' as const,
          reasons: ['Password matches a commonly used or easily guessable pattern.'],
        };
      }
      return { valid: true, strength: 'strong' as const, reasons: [] };
    }),
  };
});

const PASSWORD_PLACEHOLDER = 'Enter a strong password';
const CONFIRM_PLACEHOLDER = 'Re-enter your password';

describe('PasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders password and confirm fields', () => {
    render(<PasswordScreen flow="create" />);

    expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(CONFIRM_PLACEHOLDER)).toBeInTheDocument();
  });

  it('disables Continue when passwords are empty', () => {
    render(<PasswordScreen flow="create" />);

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('shows strength indicator when password is entered', () => {
    render(<PasswordScreen flow="create" />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    fireEvent.change(passwordInput, { target: { value: 'StrongP@ss1' } });

    expect(screen.getByText(/strong/i)).toBeInTheDocument();
  });

  it('shows validation reasons when password is weak', () => {
    render(<PasswordScreen flow="create" />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    fireEvent.change(passwordInput, { target: { value: 'short' } });

    expect(screen.getByText(/password must be at least/i)).toBeInTheDocument();
  });

  it('shows mismatch error when passwords differ', () => {
    render(<PasswordScreen flow="create" />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    const confirmInput = screen.getByPlaceholderText(CONFIRM_PLACEHOLDER);

    fireEvent.change(passwordInput, { target: { value: 'StrongP@ss1' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentP@ss1' } });

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
  });

  it('enables Continue when password is valid and confirmed', () => {
    render(<PasswordScreen flow="create" />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    const confirmInput = screen.getByPlaceholderText(CONFIRM_PLACEHOLDER);

    fireEvent.change(passwordInput, { target: { value: 'StrongP@ss1' } });
    fireEvent.change(confirmInput, { target: { value: 'StrongP@ss1' } });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('calls onComplete with password when Continue is clicked', async () => {
    const onComplete = jest.fn().mockResolvedValue(undefined);

    render(<PasswordScreen flow="create" onComplete={onComplete} />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    const confirmInput = screen.getByPlaceholderText(CONFIRM_PLACEHOLDER);

    fireEvent.change(passwordInput, { target: { value: 'StrongP@ss1' } });
    fireEvent.change(confirmInput, { target: { value: 'StrongP@ss1' } });

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(onComplete).toHaveBeenCalledWith('StrongP@ss1');
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = jest.fn();

    render(<PasswordScreen flow="create" onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();

    render(<PasswordScreen flow="create" onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows "Setting up..." text while submitting', async () => {
    const onComplete = jest
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<PasswordScreen flow="create" onComplete={onComplete} />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    const confirmInput = screen.getByPlaceholderText(CONFIRM_PLACEHOLDER);

    fireEvent.change(passwordInput, { target: { value: 'StrongP@ss1' } });
    fireEvent.change(confirmInput, { target: { value: 'StrongP@ss1' } });

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('button', { name: /setting up/i })).toBeDisabled();
  });

  it('shows error message when onComplete throws', async () => {
    const onComplete = jest.fn().mockRejectedValue(new Error('Vault error'));

    render(<PasswordScreen flow="create" onComplete={onComplete} />);

    const passwordInput = screen.getByPlaceholderText(PASSWORD_PLACEHOLDER);
    const confirmInput = screen.getByPlaceholderText(CONFIRM_PLACEHOLDER);

    fireEvent.change(passwordInput, { target: { value: 'StrongP@ss1' } });
    fireEvent.change(confirmInput, { target: { value: 'StrongP@ss1' } });

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await screen.findByText(/failed to create wallet/i);
  });
});
