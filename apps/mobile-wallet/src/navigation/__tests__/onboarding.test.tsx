import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { importWallet } from '@ancore/core-sdk';
import { validateMnemonic } from '@ancore/crypto';

import { OnboardingNavigatorTestHarness } from '..';

jest.mock('@ancore/core-sdk', () => ({
  importWallet: jest.fn().mockResolvedValue({
    mnemonic:
      'abandon ability able about above absent absorb abstract absurd abuse access accident',
    publicKey: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
    secretKey: 'SABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
    accountIndex: 0,
    contractId: 'CABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
  }),
}));

jest.mock('@ancore/crypto', () => ({
  generateMnemonic: jest
    .fn()
    .mockReturnValue(
      'abandon ability able about above absent absorb abstract absurd abuse access accident'
    ),
  validateMnemonic: jest.fn().mockReturnValue(true),
  validatePasswordStrength: jest.fn().mockReturnValue({
    valid: true,
    strength: 'strong' as const,
    reasons: [],
  }),
}));

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const TEST_PASSWORD = 'StrongP@ssword1!';
const TEST_WALLET_NAME = 'Demo Wallet';

function goThroughCreateFlow() {
  fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
  expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/wallet name/i), {
    target: { value: TEST_WALLET_NAME },
  });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  // MnemonicDisplayScreen
  expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /i wrote it down/i }));

  // VerifyMnemonicScreen — handle 3 word verification steps
  expect(screen.getByRole('heading', { name: /verify your recovery phrase/i })).toBeInTheDocument();

  const words = TEST_MNEMONIC.split(' ');

  for (let step = 0; step < 3; step++) {
    const heading = screen.getByText(/select word #\d+/i);
    const match = heading.textContent?.match(/#(\d+)/);
    const position = parseInt(match![1], 10) - 1;
    const correctWord = words[position];

    fireEvent.click(screen.getByRole('button', { name: correctWord }));
  }

  // PasswordScreen
  expect(screen.getByRole('heading', { name: /set a password/i })).toBeInTheDocument();
}

function goThroughImportFlow() {
  fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
  expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
    target: { value: TEST_MNEMONIC },
  });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  // PasswordScreen
  expect(screen.getByRole('heading', { name: /set a password/i })).toBeInTheDocument();
}

function enterPassword() {
  fireEvent.change(screen.getByPlaceholderText('Enter a strong password'), {
    target: { value: TEST_PASSWORD },
  });
  fireEvent.change(screen.getByPlaceholderText('Re-enter your password'), {
    target: { value: TEST_PASSWORD },
  });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
}

describe('OnboardingNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('moves forward from entry to create and back to entry', () => {
    render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
    expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('cancels import and recover flows back to the entry screen', () => {
    const { rerender } = render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
    expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();

    rerender(<OnboardingNavigatorTestHarness />);
    fireEvent.click(screen.getByRole('button', { name: /recover from backup/i }));
    expect(screen.getByRole('heading', { name: /recover from backup/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('completes a full create flow: display → verify → password → vault write → complete', async () => {
    const mockImportWallet = jest.mocked(importWallet);

    render(<OnboardingNavigatorTestHarness />);

    goThroughCreateFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(mockImportWallet).toHaveBeenCalledWith({
      mnemonic: TEST_MNEMONIC,
      password: TEST_PASSWORD,
    });
  });

  it('completes a full import flow: validate mnemonic → password → vault write → complete', async () => {
    const mockImportWallet = jest.mocked(importWallet);

    render(<OnboardingNavigatorTestHarness />);

    goThroughImportFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(mockImportWallet).toHaveBeenCalledWith({
      mnemonic: TEST_MNEMONIC,
      password: TEST_PASSWORD,
    });
  });

  it('clears mnemonic from state after vault write', async () => {
    render(<OnboardingNavigatorTestHarness />);

    goThroughCreateFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(TEST_MNEMONIC)).not.toBeInTheDocument();
  });

  it('navigates back through create sub-steps', () => {
    render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));

    // create → create-display
    fireEvent.change(screen.getByLabelText(/wallet name/i), {
      target: { value: TEST_WALLET_NAME },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();

    // Back to create
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();

    // Type name again and forward to display
    fireEvent.change(screen.getByLabelText(/wallet name/i), {
      target: { value: TEST_WALLET_NAME },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();

    // Forward to verify
    fireEvent.click(screen.getByRole('button', { name: /i wrote it down/i }));
    expect(
      screen.getByRole('heading', { name: /verify your recovery phrase/i })
    ).toBeInTheDocument();

    // Back to display
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();
  });

  it('completes and restarts to entry screen', async () => {
    render(<OnboardingNavigatorTestHarness />);

    goThroughCreateFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /restart onboarding/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('guards invalid initial routes back to the entry screen', () => {
    render(<OnboardingNavigatorTestHarness initialState={{ route: 'complete' }} />);

    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('shows error when import wallet has invalid mnemonic on WalletImportScreen', () => {
    jest.mocked(validateMnemonic).mockReturnValue(false);

    render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: {
        value: 'apple banana cherry date elderberry fig grape honeydew Italian bean kale lemon',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/invalid recovery phrase/i);
  });

  // HD account discovery scan on wallet import to surface existing funded accounts
  // See https://github.com/anomalyco/ancore/issues/788
  test.skip('import flow discovers funded HD accounts', () => {
    expect(true).toBe(true);
  });
});
