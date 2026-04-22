import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { MnemonicScreen } from '../MnemonicScreen';
import { PasswordScreen } from '../PasswordScreen';
import { DeployScreen } from '../DeployScreen';
import { SuccessScreen } from '../SuccessScreen';

describe('Onboarding E2E Flow', () => {
  const mockMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('should complete full onboarding flow', async () => {
    // Step 1: Welcome Screen
    const onWelcomeNext = vi.fn();
    render(<WelcomeScreen onNext={onWelcomeNext} />);

    expect(screen.getByText(/Welcome to Ancore/i)).toBeInTheDocument();

    const getStartedButton = screen.getByRole('button', { name: /Get Started/i });
    fireEvent.click(getStartedButton);

    expect(onWelcomeNext).toHaveBeenCalled();

    // Step 2: Mnemonic Screen
    const onMnemonicNext = vi.fn();
    const onMnemonicBack = vi.fn();
    render(
      <MnemonicScreen mnemonic={mockMnemonic} onNext={onMnemonicNext} onBack={onMnemonicBack} />
    );

    expect(screen.getByText(/Your Recovery Phrase/i)).toBeInTheDocument();
    expect(screen.getByText(/security warning/i)).toBeInTheDocument();

    const continueButton = screen.getByRole('button', { name: /Continue/i });
    fireEvent.click(continueButton);

    expect(onMnemonicNext).toHaveBeenCalled();

    // Step 3: Password Screen
    const onPasswordSubmit = vi.fn();
    const onPasswordBack = vi.fn();
    render(<PasswordScreen onSubmit={onPasswordSubmit} onBack={onPasswordBack} />);

    expect(screen.getByText(/Create Password/i)).toBeInTheDocument();

    const passwordInput = screen.getByLabelText(/Password/i);
    const confirmInput = screen.getByLabelText(/Confirm Password/i);
    const createButton = screen.getByRole('button', { name: /Create Wallet/i });

    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });
    fireEvent.click(createButton);

    expect(onPasswordSubmit).toHaveBeenCalledWith('SecurePass123!');

    // Step 4: Deploy Screen
    const onDeployComplete = vi.fn();
    const onDeployRetry = vi.fn();
    const onDeployBack = vi.fn();
    render(
      <DeployScreen onComplete={onDeployComplete} onRetry={onDeployRetry} onBack={onDeployBack} />
    );

    expect(screen.getByText(/Deploying Account/i)).toBeInTheDocument();

    // Step 5: Success Screen
    const mockPublicKey = 'GABC123XYZ789';
    const onSuccessComplete = vi.fn();
    render(<SuccessScreen publicKey={mockPublicKey} onComplete={onSuccessComplete} />);

    expect(screen.getByText(/Account Created/i)).toBeInTheDocument();
    expect(screen.getByText(mockPublicKey)).toBeInTheDocument();
  });

  it('should show password validation errors', () => {
    const onPasswordSubmit = vi.fn();
    const onPasswordBack = vi.fn();
    render(<PasswordScreen onSubmit={onPasswordSubmit} onBack={onPasswordBack} />);

    const passwordInput = screen.getByLabelText(/Password/i);
    const confirmInput = screen.getByLabelText(/Confirm Password/i);
    const createButton = screen.getByRole('button', { name: /Create Wallet/i });

    // Test weak password
    fireEvent.change(passwordInput, { target: { value: 'weak' } });
    fireEvent.change(confirmInput, { target: { value: 'weak' } });
    fireEvent.click(createButton);

    expect(screen.getByText(/Password is too weak/i)).toBeInTheDocument();
    expect(onPasswordSubmit).not.toHaveBeenCalled();

    // Test mismatched passwords
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPass123!' } });
    fireEvent.click(createButton);

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(onPasswordSubmit).not.toHaveBeenCalled();
  });
});
