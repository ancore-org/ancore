import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';

import { MnemonicDisplayScreen } from '../MnemonicDisplayScreen';

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

describe('MnemonicDisplayScreen', () => {
  it('renders all 12 words in a numbered grid', () => {
    render(<MnemonicDisplayScreen mnemonic={TEST_MNEMONIC} />);

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(12);

    const words = TEST_MNEMONIC.split(' ');
    listItems.forEach((item, index) => {
      expect(item).toHaveTextContent(`${index + 1}.`);
      expect(item).toHaveTextContent(words[index]);
    });
  });

  it('calls onContinue when "I wrote it down" is clicked', () => {
    const onContinue = jest.fn();

    render(<MnemonicDisplayScreen mnemonic={TEST_MNEMONIC} onContinue={onContinue} />);

    fireEvent.click(screen.getByRole('button', { name: /i wrote it down/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = jest.fn();

    render(<MnemonicDisplayScreen mnemonic={TEST_MNEMONIC} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();

    render(<MnemonicDisplayScreen mnemonic={TEST_MNEMONIC} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
