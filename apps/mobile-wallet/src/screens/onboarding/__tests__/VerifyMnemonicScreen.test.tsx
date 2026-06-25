import '@testing-library/jest-dom';

import { fireEvent, render, screen } from '@testing-library/react';

import { VerifyMnemonicScreen } from '../VerifyMnemonicScreen';

const TEST_MNEMONIC =
  'abandon ability able about above absent absorb abstract absurd abuse access accident';

describe('VerifyMnemonicScreen', () => {
  const getWordButtons = (): HTMLElement[] => {
    const grid = screen.getByRole('group', { name: /word options/i });
    return Array.from(grid.querySelectorAll('button'));
  };

  const selectCorrectWord = (mnemonic: string, position: number): void => {
    const correctWord = mnemonic.split(' ')[position];
    const buttons = getWordButtons();
    const correctButton = buttons.find((btn) => btn.textContent === correctWord);
    expect(correctButton).toBeInTheDocument();
    fireEvent.click(correctButton!);
  };

  it('renders word options for the first verification position', () => {
    render(<VerifyMnemonicScreen mnemonic={TEST_MNEMONIC} />);

    expect(
      screen.getByRole('heading', { name: /verify your recovery phrase/i })
    ).toBeInTheDocument();

    const buttons = getWordButtons();
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    expect(buttons.length).toBeLessThanOrEqual(4);
  });

  it('calls onComplete when all words are selected correctly', () => {
    const onComplete = jest.fn();

    render(<VerifyMnemonicScreen mnemonic={TEST_MNEMONIC} onComplete={onComplete} />);

    // The screen picks 3 random positions; we need to find and select
    // the correct word for each step. Since positions are random, we
    // determine them at each step by finding the correct word in the options.
    for (let step = 0; step < 3; step++) {
      const heading = screen.getByText(/select word #\d+/i);
      const match = heading.textContent?.match(/#(\d+)/);
      expect(match).not.toBeNull();
      const position = parseInt(match![1], 10) - 1;

      selectCorrectWord(TEST_MNEMONIC, position);
    }

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows error on wrong word selection and allows retry', () => {
    const onComplete = jest.fn();

    render(<VerifyMnemonicScreen mnemonic={TEST_MNEMONIC} onComplete={onComplete} />);

    const buttons = getWordButtons();
    const words = TEST_MNEMONIC.split(' ');

    // Find a wrong word to click
    const heading = screen.getByText(/select word #\d+/i);
    const match = heading.textContent?.match(/#(\d+)/);
    expect(match).not.toBeNull();
    const position = parseInt(match![1], 10) - 1;
    const correctWord = words[position];
    const wrongButton = buttons.find((btn) => btn.textContent !== correctWord);
    expect(wrongButton).toBeInTheDocument();

    fireEvent.click(wrongButton!);

    expect(screen.getByRole('alert')).toHaveTextContent(/incorrect word/i);
    expect(onComplete).not.toHaveBeenCalled();

    // User can retry - select the correct word
    selectCorrectWord(TEST_MNEMONIC, position);

    // Alert should be gone after correct selection
    expect(onComplete).not.toHaveBeenCalled(); // Still have more positions
  });

  it('calls onBack when Back is clicked', () => {
    const onBack = jest.fn();

    render(<VerifyMnemonicScreen mnemonic={TEST_MNEMONIC} onBack={onBack} />);

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();

    render(<VerifyMnemonicScreen mnemonic={TEST_MNEMONIC} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
