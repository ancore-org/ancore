import '@testing-library/jest-dom';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { WalletImportScreen } from '../WalletImportScreen';

jest.mock('@ancore/crypto', () => {
  const actual = jest.requireActual('@ancore/crypto');
  return {
    ...actual,
    validateMnemonicStrength: jest.fn((mnemonic: string) => {
      const words = mnemonic.trim().split(/\s+/);
      if (
        mnemonic ===
          'abandon ability able about above absent absorb abstract absurd abuse access accident' ||
        words.length === 24
      ) {
        return;
      }

      throw new actual.MnemonicValidationError('INVALID_CHECKSUM', 'Invalid recovery phrase');
    }),
  };
});

const VALID_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const TWELVE_INVALID_WORDS =
  'apple banana cherry date elderberry fig grape honeydew italian bean kale lemon';

const DISCOVERED_ACCOUNTS = [
  {
    accountIndex: 1,
    publicKey: 'GDISCOVERED111111111111111111111111111111111111111',
    balance: '12.0000000',
  },
];

describe('WalletImportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the mnemonic textarea in paste mode', () => {
    render(<WalletImportScreen />);

    expect(screen.getByLabelText(/recovery phrase/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();
  });

  it('enables Continue when 12 words are entered', () => {
    render(<WalletImportScreen />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: VALID_MNEMONIC },
    });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('disables Continue when fewer than 12 words', () => {
    render(<WalletImportScreen />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: 'abandon ability able' },
    });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('calls onContinue with normalized mnemonic and account index when discovery is skipped', async () => {
    const onContinue = jest.fn();

    render(<WalletImportScreen onContinue={onContinue} />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: VALID_MNEMONIC },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(onContinue).toHaveBeenCalledWith(VALID_MNEMONIC, 0);
    });
  });

  it('shows discovered accounts and continues with the selected account index', async () => {
    const onContinue = jest.fn();
    const discoverAccounts = jest.fn().mockResolvedValue(DISCOVERED_ACCOUNTS);

    render(<WalletImportScreen discoverAccounts={discoverAccounts} onContinue={onContinue} />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: VALID_MNEMONIC },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByRole('heading', { name: /choose an account/i })).toBeInTheDocument();
    expect(screen.getByText(/12.0000000 XLM/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(onContinue).toHaveBeenCalledWith(VALID_MNEMONIC, 1);
  });

  it('shows scanning progress and allows cancelling the discovery scan', async () => {
    const discoverAccounts = jest.fn(
      (_mnemonic, options) =>
        new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Discovery scan cancelled', 'AbortError'));
          });
        })
    );

    render(<WalletImportScreen discoverAccounts={discoverAccounts} />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: VALID_MNEMONIC },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(
      await screen.findByRole('heading', { name: /scanning for accounts/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel scan/i }));

    expect(
      await screen.findByRole('heading', { name: /import an existing wallet/i })
    ).toBeInTheDocument();
  });

  it('shows error and does not call onContinue when mnemonic is invalid', async () => {
    const onContinue = jest.fn();

    render(<WalletImportScreen onContinue={onContinue} />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: TWELVE_INVALID_WORDS },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/invalid recovery phrase/i);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('clears error when the user types again', () => {
    render(<WalletImportScreen />);

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: TWELVE_INVALID_WORDS },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/recovery phrase/i), {
      target: { value: VALID_MNEMONIC },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('supports word-by-word entry with autocomplete inputs', () => {
    render(<WalletImportScreen />);

    fireEvent.click(screen.getByRole('button', { name: /word by word/i }));

    expect(screen.getByLabelText('Recovery word 1', { exact: true })).toHaveAttribute(
      'list',
      'bip39-wordlist'
    );
    expect(screen.getByLabelText('Recovery word 12', { exact: true })).toBeInTheDocument();
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = jest.fn();

    render(<WalletImportScreen onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();

    render(<WalletImportScreen onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
