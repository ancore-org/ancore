import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OnboardingNavigatorTestHarness } from '..';

describe('OnboardingNavigator', () => {
  it('moves forward from entry to create and back to entry', () => {
    render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
    expect(screen.getByRole('heading', { name: /create a new wallet/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('cancels import and recover flows back to the entry screen', () => {
    const { rerender } = render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /import an existing wallet/i }));
    expect(screen.getByRole('heading', { name: /import an existing wallet/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();

    rerender(<OnboardingNavigatorTestHarness />);
    fireEvent.click(screen.getByRole('button', { name: /recover from backup/i }));
    expect(screen.getByRole('heading', { name: /recover from backup/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('completes a create flow and restarts to the entry screen', () => {
    render(<OnboardingNavigatorTestHarness />);

    fireEvent.click(screen.getByRole('button', { name: /create a new wallet/i }));
    fireEvent.change(screen.getByLabelText(/wallet name/i), { target: { value: 'Demo Wallet' } });
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByRole('heading', { name: /wallet setup complete/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /restart onboarding/i }));
    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });

  it('guards invalid initial routes back to the entry screen', () => {
    render(<OnboardingNavigatorTestHarness initialState={{ route: 'complete' }} />);

    expect(screen.getByRole('heading', { name: /set up your wallet/i })).toBeInTheDocument();
  });
});
