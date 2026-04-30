import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnboardingHints } from '../OnboardingHints';
import React from 'react';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('lucide-react', () => ({
  ArrowDownLeft: () => <div data-testid="arrow-down-left-icon" />,
  Send: () => <div data-testid="send-icon" />,
}));

vi.mock('@ancore/ui-kit', () => ({
  EmptyState: ({ title, description, action }: any) => (
    <div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  ),
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

describe('OnboardingHints', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders the Fund Your Account hint', () => {
    render(<OnboardingHints />);
    expect(screen.getByText('Fund Your Account')).toBeInTheDocument();
    expect(
      screen.getByText('Add XLM to your wallet to get started with transactions.')
    ).toBeInTheDocument();
  });

  it('renders the Make Your First Transaction hint', () => {
    render(<OnboardingHints />);
    expect(screen.getByText('Make Your First Transaction')).toBeInTheDocument();
    expect(
      screen.getByText('Send XLM to another Stellar address to activate your account.')
    ).toBeInTheDocument();
  });

  it('renders both action buttons', () => {
    render(<OnboardingHints />);
    expect(screen.getByRole('button', { name: 'Request Funds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send XLM' })).toBeInTheDocument();
  });

  it('navigates to /request when Request Funds is clicked', () => {
    render(<OnboardingHints />);
    fireEvent.click(screen.getByRole('button', { name: 'Request Funds' }));
    expect(mockNavigate).toHaveBeenCalledWith('/request');
  });

  it('navigates to /send when Send XLM is clicked', () => {
    render(<OnboardingHints />);
    fireEvent.click(screen.getByRole('button', { name: 'Send XLM' }));
    expect(mockNavigate).toHaveBeenCalledWith('/send');
  });
});
