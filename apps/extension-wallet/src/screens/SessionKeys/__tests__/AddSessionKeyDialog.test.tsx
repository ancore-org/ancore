import { render, screen, fireEvent } from '@testing-library/react';
import { StrKey, Keypair } from '@stellar/stellar-sdk';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AddSessionKeyDialog } from '../AddSessionKeyDialog';

const VALID_CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 1));
const ACCOUNT_KEY = Keypair.random().publicKey();

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

function setup() {
  render(<AddSessionKeyDialog open onClose={vi.fn()} onSave={vi.fn()} />);
  return {
    input: screen.getByLabelText(/contract address/i),
    addButton: screen.getByRole('button', { name: /add contract/i }),
  };
}

describe('AddSessionKeyDialog contract allowlist', () => {
  it('disables Add Contract while the input is empty', () => {
    const { addButton } = setup();
    expect(addButton).toBeDisabled();
  });

  it('accepts a valid Soroban contract ID', () => {
    const { input, addButton } = setup();
    fireEvent.change(input, { target: { value: VALID_CONTRACT } });
    fireEvent.blur(input);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(addButton).toBeEnabled();

    fireEvent.click(addButton);
    expect(screen.getByText(VALID_CONTRACT)).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('rejects a classic G... account address with a specific message on blur', () => {
    const { input, addButton } = setup();
    fireEvent.change(input, { target: { value: ACCOUNT_KEY } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Must be a valid Soroban contract ID (C...), not an account address (G...)'
    );
    expect(addButton).toBeDisabled();
  });

  it('rejects a truncated contract ID', () => {
    const { input, addButton } = setup();
    fireEvent.change(input, { target: { value: VALID_CONTRACT.slice(0, 40) } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Must be a valid Soroban contract ID (C...)'
    );
    expect(addButton).toBeDisabled();
  });

  it('does not add duplicates', () => {
    const { input, addButton } = setup();
    for (let i = 0; i < 2; i++) {
      fireEvent.change(input, { target: { value: VALID_CONTRACT } });
      fireEvent.click(addButton);
    }
    expect(screen.getAllByText(VALID_CONTRACT)).toHaveLength(1);
  });
});
