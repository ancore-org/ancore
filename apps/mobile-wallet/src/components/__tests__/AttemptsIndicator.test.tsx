import { render, screen } from '@testing-library/react';

import { AttemptsIndicator } from '../AttemptsIndicator';

describe('AttemptsIndicator', () => {
  it('labels how many attempts remain', () => {
    render(<AttemptsIndicator attemptsRemaining={2} maxAttempts={3} message={null} />);

    expect(screen.getByLabelText('2 of 3 attempts remaining')).toBeInTheDocument();
  });

  it('renders one dot per allowed attempt, marking the used ones', () => {
    render(<AttemptsIndicator attemptsRemaining={1} maxAttempts={3} message={null} />);

    expect(screen.getAllByTestId('attempt-available')).toHaveLength(1);
    expect(screen.getAllByTestId('attempt-used')).toHaveLength(2);
  });

  it('shows every dot as available when no attempt has been used', () => {
    render(<AttemptsIndicator attemptsRemaining={3} maxAttempts={3} message={null} />);

    expect(screen.getAllByTestId('attempt-available')).toHaveLength(3);
    expect(screen.queryAllByTestId('attempt-used')).toHaveLength(0);
  });

  it('shows every dot as used when none remain', () => {
    render(<AttemptsIndicator attemptsRemaining={0} maxAttempts={3} message={null} />);

    expect(screen.getAllByTestId('attempt-used')).toHaveLength(3);
  });

  it('styles used and available dots differently', () => {
    render(<AttemptsIndicator attemptsRemaining={1} maxAttempts={2} message={null} />);

    expect(screen.getByTestId('attempt-available')).toHaveStyle({ backgroundColor: '#22c55e' });
    expect(screen.getByTestId('attempt-used')).toHaveStyle({ backgroundColor: '#e2e8f0' });
  });

  it('hides the decorative dots from assistive technology', () => {
    render(<AttemptsIndicator attemptsRemaining={1} maxAttempts={3} message={null} />);

    const dots = screen.getAllByTestId('attempt-used')[0].parentElement;
    expect(dots).toHaveAttribute('aria-hidden', 'true');
  });

  it('announces the message politely when there is one', () => {
    render(
      <AttemptsIndicator attemptsRemaining={2} maxAttempts={3} message="Biometric not recognised" />
    );

    const message = screen.getByText('Biometric not recognised');
    expect(message).toHaveAttribute('aria-live', 'polite');
  });

  it('renders no message text when the message is null or empty', () => {
    const { container, rerender } = render(
      <AttemptsIndicator attemptsRemaining={2} maxAttempts={3} message={null} />
    );
    expect(container.textContent).toBe('');

    rerender(<AttemptsIndicator attemptsRemaining={2} maxAttempts={3} message="" />);
    expect(container.textContent).toBe('');
  });
});
