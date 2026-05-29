import { render, screen } from '@testing-library/react';

import { TransactionStatusIcon } from '../TransactionStatusIcon';
import type { TransactionStatus } from '../../screens/history/types';

describe('TransactionStatusIcon', () => {
  describe('status rendering', () => {
    const statuses: TransactionStatus[] = ['success', 'completed', 'pending', 'failed'];

    statuses.forEach((status) => {
      it(`renders ${status} status with correct icon and label`, () => {
        render(<TransactionStatusIcon status={status} />);

        const icon = screen.getByRole('img');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('aria-label');
        expect(icon.getAttribute('aria-label')).toContain(status);
      });
    });
  });

  describe('unknown status handling', () => {
    it('renders unknown status when status is undefined', () => {
      render(<TransactionStatusIcon />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('aria-label', 'Transaction status unknown');
    });

    it('renders unknown status with neutral icon and color', () => {
      render(<TransactionStatusIcon />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('text-slate-500');
      expect(icon.textContent).toBe('?');
    });

    it('calls onUnknownStatus callback for invalid status', () => {
      const onUnknownStatus = jest.fn();
      const invalidStatus = 'invalid-status' as TransactionStatus;

      render(<TransactionStatusIcon status={invalidStatus} onUnknownStatus={onUnknownStatus} />);

      expect(onUnknownStatus).toHaveBeenCalledWith(invalidStatus);
    });

    it('does not call onUnknownStatus for valid statuses', () => {
      const onUnknownStatus = jest.fn();

      render(<TransactionStatusIcon status="success" onUnknownStatus={onUnknownStatus} />);

      expect(onUnknownStatus).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has role="img" for semantic meaning', () => {
      render(<TransactionStatusIcon status="success" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('role', 'img');
    });

    it('has descriptive aria-label for screen readers', () => {
      render(<TransactionStatusIcon status="pending" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveAttribute('aria-label', 'Transaction pending');
    });

    it('provides context for all status types', () => {
      const { rerender } = render(<TransactionStatusIcon status="success" />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Transaction successful');

      rerender(<TransactionStatusIcon status="failed" />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Transaction failed');

      rerender(<TransactionStatusIcon status="pending" />);
      expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Transaction pending');
    });
  });

  describe('styling', () => {
    it('applies correct color class for success status', () => {
      render(<TransactionStatusIcon status="success" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('text-green-600');
    });

    it('applies correct color class for completed status', () => {
      render(<TransactionStatusIcon status="completed" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('text-green-600');
    });

    it('applies correct color class for pending status', () => {
      render(<TransactionStatusIcon status="pending" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('text-amber-600');
    });

    it('applies correct color class for failed status', () => {
      render(<TransactionStatusIcon status="failed" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('text-red-600');
    });

    it('applies correct color class for unknown status', () => {
      render(<TransactionStatusIcon />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('text-slate-500');
    });

    it('has consistent sizing and layout classes', () => {
      render(<TransactionStatusIcon status="success" />);

      const icon = screen.getByRole('img');
      expect(icon).toHaveClass('inline-flex', 'items-center', 'justify-center', 'w-5', 'h-5');
    });
  });

  describe('icon content', () => {
    it('displays check mark for success', () => {
      render(<TransactionStatusIcon status="success" />);

      expect(screen.getByRole('img')).toHaveTextContent('✓');
    });

    it('displays check mark for completed', () => {
      render(<TransactionStatusIcon status="completed" />);

      expect(screen.getByRole('img')).toHaveTextContent('✓');
    });

    it('displays hourglass for pending', () => {
      render(<TransactionStatusIcon status="pending" />);

      expect(screen.getByRole('img')).toHaveTextContent('⏳');
    });

    it('displays X mark for failed', () => {
      render(<TransactionStatusIcon status="failed" />);

      expect(screen.getByRole('img')).toHaveTextContent('✕');
    });

    it('displays question mark for unknown', () => {
      render(<TransactionStatusIcon />);

      expect(screen.getByRole('img')).toHaveTextContent('?');
    });
  });
});
