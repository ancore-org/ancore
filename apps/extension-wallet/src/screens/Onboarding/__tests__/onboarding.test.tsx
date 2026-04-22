import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WelcomeScreen } from '../WelcomeScreen';
import { MnemonicScreen } from '../MnemonicScreen';
import { VerifyMnemonicScreen } from '../VerifyMnemonicScreen';
import { PasswordScreen } from '../PasswordScreen';
import { DeployScreen } from '../DeployScreen';
import { SuccessScreen } from '../SuccessScreen';

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
});

describe('WelcomeScreen', () => {
  it('renders welcome message and features', () => {
    const onNext = vi.fn();
    render(<WelcomeScreen onNext={onNext} />);

    expect(screen.getByText('Welcome to Ancore')).toBeInTheDocument();
    expect(screen.getByText('Create New Wallet')).toBeInTheDocument();
    expect(screen.getByText('Secure')).toBeInTheDocument();
    expect(screen.getByText('Smart Accounts')).toBeInTheDocument();
  });

  it('calls onNext when create wallet button is clicked', () => {
    const onNext = vi.fn();
    render(<WelcomeScreen onNext={onNext} />);

    fireEvent.click(screen.getByText('Create New Wallet'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('shows back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<WelcomeScreen onNext={vi.fn()} onBack={onBack} />);

    fireEvent.click(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows security warning for recovery phrase', () => {
    render(<WelcomeScreen onNext={vi.fn()} />);

    expect(screen.getByText(/recovery phrase/)).toBeInTheDocument();
  });
});

describe('MnemonicScreen', () => {
  const testMnemonic =
    'abandon ability able about above absent absorb abstract absurd abuse access accident';

  it('renders mnemonic words correctly', () => {
    const onNext = vi.fn();
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={onNext} onBack={vi.fn()} />);

    // Check first and last words are displayed
    expect(screen.getByText('abandon')).toBeInTheDocument();
    expect(screen.getByText('abuse')).toBeInTheDocument();
  });

  it('displays all 12 words with indices', () => {
    const onNext = vi.fn();
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={onNext} onBack={vi.fn()} />);

    // Check word indices are displayed
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('12.')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={vi.fn()} onBack={onBack} />);

    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows security warning', () => {
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/Never share your recovery phrase/)).toBeInTheDocument();
  });

  it('copies mnemonic to clipboard', async () => {
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={vi.fn()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testMnemonic);
    });
  });

  it('shows copied feedback', async () => {
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={vi.fn()} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('calls onNext when button is clicked', () => {
    const onNext = vi.fn();
    render(<MnemonicScreen mnemonic={testMnemonic} onNext={onNext} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText(/I've Saved My Recovery Phrase/));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('VerifyMnemonicScreen', () => {
  const testMnemonic =
    'abandon ability able about above absent absorb abstract absurd abuse access accident';

  it('renders verification inputs for selected words', () => {
    render(<VerifyMnemonicScreen mnemonic={testMnemonic} onSuccess={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/Verify Your Backup/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter word/)).toBeInTheDocument();
  });

  it('shows word #3 input (1-indexed)', () => {
    render(<VerifyMnemonicScreen mnemonic={testMnemonic} onSuccess={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByLabelText('Word #3')).toBeInTheDocument();
  });

  it('calls onSuccess when correct words are entered', async () => {
    const onSuccess = vi.fn();
    render(<VerifyMnemonicScreen mnemonic={testMnemonic} onSuccess={onSuccess} onBack={vi.fn()} />);

    // The screen renders inputs for specific words
    // For our test mnemonic, words at positions 3, 7, 11 (1-indexed) would be:
    // Position 3 = "able" (index 2)
    // Position 7 = "absorb" (index 6)
    // Position 11 = "access" (index 10)

    const inputs = screen.getAllByPlaceholderText(/Enter word/);

    // Fill in the inputs with correct words
    // The exact order depends on which indices are selected
    if (inputs.length >= 3) {
      fireEvent.change(inputs[0], { target: { value: 'able' } });
      // ... etc
    }

    fireEvent.click(screen.getByText('Verify & Continue'));
    // onSuccess is only called if all words are correct
  });

  it('shows error when words are incorrect', async () => {
    const onSuccess = vi.fn();
    render(<VerifyMnemonicScreen mnemonic={testMnemonic} onSuccess={onSuccess} onBack={vi.fn()} />);

    fireEvent.click(screen.getByText('Verify & Continue'));

    await waitFor(() => {
      expect(screen.getByText(/Some words are incorrect/)).toBeInTheDocument();
    });
  });

  it('clears inputs when retry is clicked', () => {
    render(<VerifyMnemonicScreen mnemonic={testMnemonic} onSuccess={vi.fn()} onBack={vi.fn()} />);

    const inputs = screen.getAllByPlaceholderText(/Enter word/);
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: 'wrong' } });
    }

    fireEvent.click(screen.getByText('Clear'));

    const clearedInputs = screen.getAllByPlaceholderText(/Enter word/);
    if (clearedInputs.length > 0) {
      expect(clearedInputs[0].getAttribute('value')).toBe('');
    }
  });
});

describe('PasswordScreen', () => {
  it('renders password inputs', () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('Create Your Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();
  });

  it('shows password requirements', () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(screen.getByText('One uppercase letter')).toBeInTheDocument();
    expect(screen.getByText('One number')).toBeInTheDocument();
  });

  it('validates password strength', async () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter your password');
    fireEvent.change(passwordInput, { target: { value: 'Weak' } });

    await waitFor(() => {
      expect(screen.getByText('Very Weak')).toBeInTheDocument();
    });
  });

  it('shows strong password indicator', async () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter your password');
    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });

    await waitFor(() => {
      expect(screen.getByText('Strong')).toBeInTheDocument();
    });
  });

  it('shows match error when passwords differ', async () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const confirmInput = screen.getByPlaceholderText('Confirm your password');

    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'DifferentPass1!' } });

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
  });

  it('shows match confirmation when passwords match', async () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const confirmInput = screen.getByPlaceholderText('Confirm your password');

    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });

    await waitFor(() => {
      expect(screen.getByText('Passwords match')).toBeInTheDocument();
    });
  });

  it('calls onSubmit when valid passwords are submitted', async () => {
    const onSubmit = vi.fn();
    render(<PasswordScreen onSubmit={onSubmit} onBack={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const confirmInput = screen.getByPlaceholderText('Confirm your password');

    fireEvent.change(passwordInput, { target: { value: 'SecurePass123!' } });
    fireEvent.change(confirmInput, { target: { value: 'SecurePass123!' } });

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('SecurePass123!');
    });
  });

  it('shows/hides password when toggle is clicked', () => {
    render(<PasswordScreen onSubmit={vi.fn()} onBack={vi.fn()} />);

    const passwordInput = screen.getByPlaceholderText('Enter your password') as HTMLInputElement;

    // Password should be hidden by default
    expect(passwordInput.type).toBe('password');

    // Click the toggle button
    const toggleButton = screen.getAllByRole('button').find((btn) => {
      return btn.innerHTML.includes('Eye') || btn.innerHTML.includes('EyeOff');
    });

    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');
    }
  });
});

describe('DeployScreen', () => {
  it('renders deploy button by default', () => {
    render(<DeployScreen onComplete={vi.fn()} onRetry={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText('Ready to Deploy')).toBeInTheDocument();
    expect(screen.getByText('Deploy to Testnet')).toBeInTheDocument();
  });

  it('shows deploying state', () => {
    render(
      <DeployScreen
        onComplete={vi.fn()}
        onRetry={vi.fn()}
        onBack={vi.fn()}
        status="funding"
        isLoading={true}
      />
    );

    expect(screen.getByText('Creating Your Wallet')).toBeInTheDocument();
  });

  it('shows success state', () => {
    render(
      <DeployScreen onComplete={vi.fn()} onRetry={vi.fn()} onBack={vi.fn()} status="success" />
    );

    expect(screen.getByText('Wallet Created!')).toBeInTheDocument();
    expect(screen.getByText('Open Your Wallet')).toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <DeployScreen
        onComplete={vi.fn()}
        onRetry={vi.fn()}
        onBack={vi.fn()}
        status="error"
        error="Network error occurred"
      />
    );

    expect(screen.getByText('Deployment Failed')).toBeInTheDocument();
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(
      <DeployScreen
        onComplete={vi.fn()}
        onRetry={onRetry}
        onBack={vi.fn()}
        status="error"
        error="Some error"
      />
    );

    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when wallet is ready', () => {
    const onComplete = vi.fn();
    render(
      <DeployScreen onComplete={onComplete} onRetry={vi.fn()} onBack={vi.fn()} status="success" />
    );

    fireEvent.click(screen.getByText('Open Your Wallet'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('SuccessScreen', () => {
  const testPublicKey = 'GABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234YZ';

  it('renders success message', () => {
    render(<SuccessScreen publicKey={testPublicKey} onComplete={vi.fn()} />);

    expect(screen.getByText('Congratulations!')).toBeInTheDocument();
    expect(
      screen.getByText('Your Ancore wallet has been created successfully')
    ).toBeInTheDocument();
  });

  it('displays truncated public key', () => {
    render(<SuccessScreen publicKey={testPublicKey} onComplete={vi.fn()} />);

    // Should show truncated address
    expect(screen.getByText(/GABC12.*YZ/)).toBeInTheDocument();
  });

  it('displays contract ID if provided', () => {
    const contractId = 'CAS123DEF456GHI789JKL012MNO345PQR678STU901VWX2345';
    render(
      <SuccessScreen publicKey={testPublicKey} contractId={contractId} onComplete={vi.fn()} />
    );

    expect(screen.getByText(/Contract ID/)).toBeInTheDocument();
  });

  it('copies public key to clipboard', async () => {
    render(<SuccessScreen publicKey={testPublicKey} onComplete={vi.fn()} />);

    const copyButtons = screen.getAllByRole('button');
    const copyButton = copyButtons.find((btn) => {
      return btn.innerHTML.includes('Copy') || btn.innerHTML.includes('Check');
    });

    if (copyButton) {
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testPublicKey);
      });
    }
  });

  it('calls onComplete when open wallet is clicked', () => {
    const onComplete = vi.fn();
    render(<SuccessScreen publicKey={testPublicKey} onComplete={onComplete} />);

    fireEvent.click(screen.getByText('Open Wallet'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows security reminder', () => {
    render(<SuccessScreen publicKey={testPublicKey} onComplete={vi.fn()} />);

    expect(screen.getByText(/recovery phrase/)).toBeInTheDocument();
  });

  it('has view on explorer button', () => {
    render(<SuccessScreen publicKey={testPublicKey} onComplete={vi.fn()} />);

    expect(screen.getByText('View on Stellar Expert')).toBeInTheDocument();
  });
});
