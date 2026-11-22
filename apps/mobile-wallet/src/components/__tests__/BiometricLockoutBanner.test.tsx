import { render, screen } from '@testing-library/react';

import { BiometricLockoutBanner } from '../BiometricLockoutBanner';

describe('BiometricLockoutBanner', () => {
  describe('temporary lockout', () => {
    it('shows the countdown in the title', () => {
      render(<BiometricLockoutBanner isPermanent={false} secondsRemaining={42} message={null} />);

      expect(screen.getByText('Temporarily locked — 42s remaining')).toBeInTheDocument();
    });

    it('updates the countdown text when the seconds change', () => {
      const { rerender } = render(
        <BiometricLockoutBanner isPermanent={false} secondsRemaining={30} message={null} />
      );
      expect(screen.getByText(/30s remaining/)).toBeInTheDocument();

      rerender(<BiometricLockoutBanner isPermanent={false} secondsRemaining={29} message={null} />);

      expect(screen.getByText(/29s remaining/)).toBeInTheDocument();
      expect(screen.queryByText(/30s remaining/)).not.toBeInTheDocument();
    });

    it('uses a default explanation when there is no message', () => {
      render(<BiometricLockoutBanner isPermanent={false} secondsRemaining={5} message={null} />);

      expect(screen.getByText(/Too many failed attempts/)).toBeInTheDocument();
    });

    it('shows the supplied message instead of the default', () => {
      render(
        <BiometricLockoutBanner isPermanent={false} secondsRemaining={5} message="Try again soon" />
      );

      expect(screen.getByText('Try again soon')).toBeInTheDocument();
      expect(screen.queryByText(/Too many failed attempts/)).not.toBeInTheDocument();
    });
  });

  describe('permanent lockout', () => {
    it('says biometrics are disabled and ignores the countdown and message', () => {
      render(<BiometricLockoutBanner isPermanent secondsRemaining={99} message="ignored" />);

      expect(screen.getByText('Biometric authentication disabled')).toBeInTheDocument();
      expect(screen.getByText(/permanently disabled biometric access/)).toBeInTheDocument();
      expect(screen.queryByText(/99s/)).not.toBeInTheDocument();
      expect(screen.queryByText('ignored')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('is an alert that is announced politely', () => {
      render(<BiometricLockoutBanner isPermanent={false} secondsRemaining={5} message={null} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('carries the title and body in its accessible label', () => {
      render(<BiometricLockoutBanner isPermanent={false} secondsRemaining={7} message="Wait" />);

      expect(screen.getByRole('alert')).toHaveAttribute(
        'aria-label',
        'Temporarily locked — 7s remaining. Wait'
      );
    });

    it('describes the permanent lockout in its accessible label', () => {
      render(<BiometricLockoutBanner isPermanent secondsRemaining={0} message={null} />);

      expect(screen.getByRole('alert').getAttribute('aria-label')).toMatch(
        /^Biometric authentication disabled\. Your device has permanently disabled/
      );
    });
  });

  it('is styled as an error banner', () => {
    render(<BiometricLockoutBanner isPermanent={false} secondsRemaining={5} message={null} />);

    expect(screen.getByRole('alert')).toHaveStyle({
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
    });
  });
});
