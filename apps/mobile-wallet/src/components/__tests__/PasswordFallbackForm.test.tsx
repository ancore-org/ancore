import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { PasswordFallbackForm } from '../PasswordFallbackForm';

const getInput = () => screen.getByLabelText('Password');
const getSubmit = () => screen.getByRole('button', { name: /^(Unlock|Unlocking…)$/ });
const type = (value: string) => fireEvent.change(getInput(), { target: { value } });

describe('PasswordFallbackForm', () => {
  const setup = (props: Partial<ComponentProps<typeof PasswordFallbackForm>> = {}) => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<PasswordFallbackForm onSubmit={onSubmit} isLoading={false} error={null} {...props} />);
    return { onSubmit };
  };

  describe('input', () => {
    it('focuses the password field when it mounts', () => {
      setup();

      expect(getInput()).toHaveFocus();
    });

    it('hides the password by default and reveals it with Show', () => {
      setup();
      expect(getInput()).toHaveAttribute('data-secure-text-entry', 'true');

      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

      expect(getInput()).not.toHaveAttribute('data-secure-text-entry');
      expect(screen.getByRole('button', { name: 'Hide password' })).toHaveTextContent('Hide');
    });

    it('hides the password again with Hide', () => {
      setup();
      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

      fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));

      expect(getInput()).toHaveAttribute('data-secure-text-entry', 'true');
    });

    it('keeps what was typed when the password is shown or hidden', () => {
      setup();
      type('hunter2');

      fireEvent.click(screen.getByRole('button', { name: 'Show password' }));

      expect(getInput()).toHaveValue('hunter2');
    });

    it('passes the native keyboard and autofill props to TextInput', () => {
      const reactNative = jest.requireMock('react-native');
      const original = reactNative.TextInput;
      const spy = jest.fn(original);
      reactNative.TextInput = spy;

      try {
        setup();
      } finally {
        reactNative.TextInput = original;
      }

      expect(spy.mock.calls[0][0]).toMatchObject({
        secureTextEntry: true,
        autoCapitalize: 'none',
        autoCorrect: false,
        autoComplete: 'current-password',
        textContentType: 'password',
        returnKeyType: 'go',
        autoFocus: true,
      });
    });
  });

  describe('submitting', () => {
    it('disables Unlock until something is typed', () => {
      setup();

      expect(getSubmit()).toBeDisabled();
      type('secret');
      expect(getSubmit()).toBeEnabled();
    });

    it('treats a whitespace-only password as empty', () => {
      const { onSubmit } = setup();
      type('   ');

      expect(getSubmit()).toBeDisabled();
      fireEvent.keyDown(getInput(), { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits the exact password, untrimmed, when Unlock is pressed', () => {
      const { onSubmit } = setup();
      type(' pass word ');

      fireEvent.click(getSubmit());

      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledWith(' pass word ');
    });

    it('submits when the keyboard go key (onSubmitEditing) is pressed', () => {
      const { onSubmit } = setup();
      type('secret');

      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledWith('secret');
    });

    it('ignores other keys', () => {
      const { onSubmit } = setup();
      type('secret');

      fireEvent.keyDown(getInput(), { key: 'a' });

      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit an empty password with the keyboard', () => {
      const { onSubmit } = setup();

      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('while loading', () => {
    it('shows Unlocking…, disables Unlock and locks the field', () => {
      setup({ isLoading: true });

      expect(getSubmit()).toHaveTextContent('Unlocking…');
      expect(getSubmit()).toBeDisabled();
      expect(getInput()).toBeDisabled();
    });

    it('does not submit, even with a password typed and the go key pressed', () => {
      const { onSubmit } = setup({ isLoading: true });
      fireEvent.change(getInput(), { target: { value: 'secret' } });

      fireEvent.keyDown(getInput(), { key: 'Enter' });
      fireEvent.click(getSubmit());

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('error', () => {
    it('shows no alert without an error', () => {
      setup();

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('announces an error politely', () => {
      setup({ error: 'Incorrect password' });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Incorrect password');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('renders no text for an empty error string', () => {
      setup({ error: '' });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('renders only React Native primitives (no form, label or input elements)', () => {
    const { container } = render(
      <PasswordFallbackForm onSubmit={jest.fn()} isLoading={false} error={null} />
    );

    expect(container.querySelector('form, label')).toBeNull();
  });
});
