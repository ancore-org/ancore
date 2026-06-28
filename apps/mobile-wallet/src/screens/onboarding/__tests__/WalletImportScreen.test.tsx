import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';

import { WalletImportScreen } from '../WalletImportScreen';

jest.mock('@ancore/crypto', () => {
  const actual = jest.requireActual('@ancore/crypto');
  return {
    ...actual,
    validateMnemonic: jest.fn((mnemonic: string) => {
      return (
        mnemonic ===
        'abandon ability able about above absent absorb abstract absurd abuse access accident'
      );
    }),
  };
});

const VALID_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';
const TWELVE_INVALID_WORDS =
  'apple banana cherry date elderberry fig grape honeydew Italian bean kale lemon mango';

describe('WalletImportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the mnemonic textarea', () => {
    render(<WalletImportScreen />);

    expect(screen.getByLabelText(/recovery phrase/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();
  });

  it('enables Continue when 12+ words are entered', () => {
    render(<WalletImportScreen />);

    const textarea = screen.getByLabelText(/recovery phrase/i);
    fireEvent.change(textarea, { target: { value: VALID_MNEMONIC } });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('disables Continue when fewer than 12 words', () => {
    render(<WalletImportScreen />);

    const textarea = screen.getByLabelText(/recovery phrase/i);
    fireEvent.change(textarea, { target: { value: 'abandon ability able' } });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('calls onContinue with normalized mnemonic when valid', () => {
    const onContinue = jest.fn();

    render(<WalletImportScreen onContinue={onContinue} />);

    const textarea = screen.getByLabelText(/recovery phrase/i);
    fireEvent.change(textarea, { target: { value: VALID_MNEMONIC } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(onContinue).toHaveBeenCalledWith(VALID_MNEMONIC);
  });

  it('shows error and does not call onContinue when mnemonic is invalid', () => {
    const onContinue = jest.fn();

    render(<WalletImportScreen onContinue={onContinue} />);

    const textarea = screen.getByLabelText(/recovery phrase/i);
    fireEvent.change(textarea, { target: { value: TWELVE_INVALID_WORDS } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/invalid recovery phrase/i);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('clears error when the user types again', () => {
    const onContinue = jest.fn();

    render(<WalletImportScreen onContinue={onContinue} />);

    const textarea = screen.getByLabelText(/recovery phrase/i);
    fireEvent.change(textarea, { target: { value: TWELVE_INVALID_WORDS } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: VALID_MNEMONIC } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
