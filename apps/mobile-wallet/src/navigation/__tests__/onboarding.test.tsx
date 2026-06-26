import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { importWallet } from '@ancore/core-sdk';
import { MnemonicValidationError, validateMnemonicStrength } from '@ancore/crypto';

import { OnboardingNavigatorTestHarness } from '..';
import type { DiscoverAccountsFn } from '../../screens/onboarding/WalletImportScreen';

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

jest.mock('@ancore/crypto', () => {
  const actual = jest.requireActual('@ancore/crypto');
  return {
    ...actual,
    generateMnemonic: jest
      .fn()
      .mockReturnValue(
        'abandon ability able about above absent absorb abstract absurd abuse access accident'
      ),
    validateMnemonicStrength: jest.fn(),
    validatePasswordStrength: jest.fn().mockReturnValue({
      valid: true,
      strength: 'strong' as const,
      reasons: [],
    }),
  };
});

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const TEST_PASSWORD = 'StrongP@ssword1!';
const TEST_WALLET_NAME = 'Demo Wallet';

const mockDiscoverAccounts: DiscoverAccountsFn = jest.fn().mockResolvedValue([
  {
    accountIndex: 2,
    publicKey: 'GFUNDED2222222222222222222222222222222222222222222222222222',
    balance: '25.0000000',
  },
]);

function mockValidMnemonic() {
  jest.mocked(validateMnemonicStrength).mockImplementation(() => undefined);
}

function goThroughCreateFlow() {
  fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
  expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/wallet name/i), {
    target: { value: TEST_WALLET_NAME },
  });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /i wrote it down/i }));

  expect(screen.getByRole('heading', { name: /verify your recovery phrase/i })).toBeInTheDocument();

  const words = TEST_MNEMONIC.split(' ');

  for (let step = 0; step < 3; step++) {
    const heading = screen.getByText(/select word #\d+/i);
    const match = heading.textContent?.match(/#(\d+)/);
    const position = parseInt(match![1], 10) - 1;
    const correctWord = words[position];

    fireEvent.click(screen.getByRole('button', { name: correctWord }));
  }

  expect(screen.getByRole('heading', { name: /set a password/i })).toBeInTheDocument();
}

async function goThroughImportFlow() {
  fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
  expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
    target: { value: TEST_MNEMONIC },
  });
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  expect(await screen.findByRole('heading', { name: /choose an account/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

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
    mockValidMnemonic();
    jest.mocked(mockDiscoverAccounts).mockResolvedValue([
      {
        accountIndex: 2,
        publicKey: 'GFUNDED2222222222222222222222222222222222222222222222222222',
        balance: '25.0000000',
      },
    ]);
  });

  it('moves forward from entry to create and back to entry', () => {
    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
    expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('cancels import and recover flows back to the entry screen', () => {
    const { rerender } = render(
      <OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />
    );

    fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
    expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();

    rerender(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);
    fireEvent.click(screen.getByRole('button', { name: /recover from backup/i }));
    expect(screen.getByRole('heading', { name: /recover from backup/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('completes a full create flow: display → verify → password → vault write → complete', async () => {
    const mockImportWallet = jest.mocked(importWallet);

    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    goThroughCreateFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(mockImportWallet).toHaveBeenCalledWith({
      mnemonic: TEST_MNEMONIC,
      password: TEST_PASSWORD,
      accountIndex: 0,
    });
  });

  it('completes a full import flow: validate mnemonic → password → vault write → complete', async () => {
    const mockImportWallet = jest.mocked(importWallet);

    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    await goThroughImportFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(mockImportWallet).toHaveBeenCalledWith({
      mnemonic: TEST_MNEMONIC,
      password: TEST_PASSWORD,
      accountIndex: 2,
    });
  });

  it('clears mnemonic from state after vault write', async () => {
    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    goThroughCreateFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(TEST_MNEMONIC)).not.toBeInTheDocument();
  });

  it('navigates back through create sub-steps', () => {
    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));

    fireEvent.change(screen.getByLabelText(/wallet name/i), {
      target: { value: TEST_WALLET_NAME },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/wallet name/i), {
      target: { value: TEST_WALLET_NAME },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /i wrote it down/i }));
    expect(
      screen.getByRole('heading', { name: /verify your recovery phrase/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /your recovery phrase/i })).toBeInTheDocument();
  });

  it('completes and restarts to entry screen', async () => {
    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    goThroughCreateFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /restart onboarding/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('guards invalid initial routes back to the entry screen', () => {
    render(
      <OnboardingNavigatorTestHarness
        discoverAccounts={mockDiscoverAccounts}
        initialState={{ route: 'complete' }}
      />
    );

    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('shows error when import wallet has invalid mnemonic on WalletImportScreen', async () => {
    jest.mocked(validateMnemonicStrength).mockImplementation(() => {
      throw new MnemonicValidationError('INVALID_CHECKSUM', 'Invalid recovery phrase');
    });

    render(<OnboardingNavigatorTestHarness discoverAccounts={mockDiscoverAccounts} />);

    fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: {
        value: 'apple banana cherry date elderberry fig grape honeydew Italian bean kale lemon',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/invalid recovery phrase/i);
  });

  it('import flow discovers funded HD accounts', async () => {
    const onPersistWallet = jest.fn().mockResolvedValue(undefined);

    render(
      <OnboardingNavigatorTestHarness
        discoverAccounts={mockDiscoverAccounts}
        onPersistWallet={onPersistWallet}
      />
    );

    await goThroughImportFlow();
    enterPassword();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();
    });

    expect(mockDiscoverAccounts).toHaveBeenCalledWith(
      TEST_MNEMONIC,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(jest.mocked(importWallet)).toHaveBeenCalledWith({
      mnemonic: TEST_MNEMONIC,
      password: TEST_PASSWORD,
      accountIndex: 2,
    });
    expect(onPersistWallet).toHaveBeenCalled();
  });
});
