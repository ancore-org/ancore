import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { MnemonicScreen } from '../MnemonicScreen';
import { PasswordScreen } from '../PasswordScreen';
import { DeployScreen } from '../DeployScreen';
import { SuccessScreen } from '../SuccessScreen';

afterEach(() => cleanup());

describe('Onboarding E2E Flow', () => {
  const mockMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('should complete full onboarding flow', () => {
    // Step 1: Welcome Screen
    const onWelcomeNext = vi.fn();
    const { unmount: u1 } = render(<WelcomeScreen onNext={onWelcomeNext} />);

    expect(screen.getByText(/Welcome to Ancore/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Create New Wallet/i }));
    expect(onWelcomeNext).toHaveBeenCalled();
    u1();

    // Step 2: Mnemonic Screen
    const onMnemonicNext = vi.fn();
    const { unmount: u2 } = render(
      <MnemonicScreen mnemonic={mockMnemonic} onNext={onMnemonicNext} onBack={vi.fn()} />
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /Your Recovery Phrase/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Never share your recovery phrase/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /I've Saved My Recovery Phrase/i }));
    expect(onMnemonicNext).toHaveBeenCalled();
    u2();

    // Step 3: Password Screen
    const onPasswordSubmit = vi.fn();
    const { unmount: u3 } = render(<PasswordScreen onSubmit={onPasswordSubmit} onBack={vi.fn()} />);

    expect(screen.getByText(/Create Your Password/i)).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmInput = screen.getByLabelText(/Confirm Password/i);

    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(onPasswordSubmit).toHaveBeenCalledWith('SecurePass123!');
    u3();

    // Step 4: Deploy Screen
    const { unmount: u4 } = render(
      <DeployScreen onComplete={vi.fn()} onRetry={vi.fn()} onBack={vi.fn()} />
    );
    expect(screen.getByText(/Ready to Deploy/i)).toBeInTheDocument();
    u4();

    // Step 5: Success Screen
    render(<SuccessScreen publicKey="GABC123XYZ789" onComplete={vi.fn()} />);
    expect(screen.getByText(/Congratulations!/i)).toBeInTheDocument();
  });

  it('should show password validation errors', () => {
    const onPasswordSubmit = vi.fn();
    render(<PasswordScreen onSubmit={onPasswordSubmit} onBack={vi.fn()} />);

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const confirmInput = screen.getByLabelText(/Confirm Password/i);

    // Test weak password — submit via the form element directly to bypass disabled button
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.change(confirmInput, { target: { value: 'weak' } });
    fireEvent.submit(passwordInput.closest('form') as HTMLFormElement);

    expect(screen.getByText(/Please meet all password requirements/i)).toBeInTheDocument();
    expect(onPasswordSubmit).not.toHaveBeenCalled();

    // Test mismatched passwords
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPass123!' } });
    // Button is enabled (requirements met) but passwords don't match
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(onPasswordSubmit).not.toHaveBeenCalled();
  });
});
