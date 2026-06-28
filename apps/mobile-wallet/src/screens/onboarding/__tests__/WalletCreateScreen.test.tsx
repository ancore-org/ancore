import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';

import { WalletCreateScreen } from '../WalletCreateScreen';

describe('WalletCreateScreen', () => {
  it('renders the wallet name input', () => {
    render(<WalletCreateScreen />);

    expect(screen.getByLabelText(/wallet name/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();
  });

  it('disables Continue when wallet name is empty', () => {
    render(<WalletCreateScreen />);

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeDisabled();
  });

  it('enables Continue when wallet name is entered', () => {
    render(<WalletCreateScreen />);

    fireEvent.change(screen.getByLabelText(/wallet name/i), {
      target: { value: 'My Wallet' },
    });

    expect(screen.getByRole('button', { name: /^continue$/i })).toBeEnabled();
  });

  it('calls onContinue when Continue is clicked', () => {
    const onContinue = jest.fn();

    render(<WalletCreateScreen onContinue={onContinue} />);

    fireEvent.change(screen.getByLabelText(/wallet name/i), {
      target: { value: 'My Wallet' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = jest.fn();

    render(<WalletCreateScreen onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();

    render(<WalletCreateScreen onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
