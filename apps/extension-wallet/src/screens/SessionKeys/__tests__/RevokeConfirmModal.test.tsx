import { render, screen, fireEvent } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RevokeConfirmModal } from '../RevokeConfirmModal';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

function setup(count = 3) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<RevokeConfirmModal open count={count} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel };
}

describe('RevokeConfirmModal', () => {
  it('states how many keys are affected and warns about connected dApps', () => {
    setup(3);
    expect(screen.getByText(/3 session keys/)).toBeInTheDocument();
    expect(screen.getByText(/connected dApps/i)).toBeInTheDocument();
  });

  it('uses singular wording for one key', () => {
    setup(1);
    expect(screen.getByText(/1 session key\b/)).toBeInTheDocument();
  });

  it('confirms only on explicit confirm click', () => {
    const { onConfirm, onCancel } = setup();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /revoke all/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels without revoking when dismissed via Cancel', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cancels without revoking when dismissed via Escape', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent(
      screen.getByRole('dialog', { hidden: true }),
      new Event('cancel', { cancelable: true })
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
