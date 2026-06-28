import { render, screen } from '@testing-library/react';

import { HistoryError } from '../HistoryError';

describe('HistoryError', () => {
  describe('network error', () => {
    it('renders network error with appropriate title and description', () => {
      render(<HistoryError kind="network" message="Network timeout" onRetry={jest.fn()} />);

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(screen.getByText(/Check your internet connection and try again/)).toBeInTheDocument();
    });

    it('renders retry button for network error', () => {
      const onRetry = jest.fn();
      render(<HistoryError kind="network" message="Network timeout" onRetry={onRetry} />);

      const button = screen.getByRole('button', { name: /Retry/ });
      expect(button).toBeInTheDocument();
      button.click();
      expect(onRetry).toHaveBeenCalled();
    });
  });

  describe('server error', () => {
    it('renders server error with appropriate title', () => {
      render(
        <HistoryError
          kind="server"
          message="HTTP 500: Internal Server Error"
          statusCode={500}
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByText('Server Error')).toBeInTheDocument();
      expect(screen.getByText(/try again later/)).toBeInTheDocument();
    });

    it('displays HTTP status code for server errors', () => {
      render(
        <HistoryError
          kind="server"
          message="HTTP 500: Internal Server Error"
          statusCode={500}
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
      expect(screen.getByRole('heading')).toHaveTextContent('Server Error');
    });

    it('displays 4xx error classification', () => {
      render(
        <HistoryError
          kind="server"
          message="HTTP 404: Not Found"
          statusCode={404}
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByText(/HTTP 404.*Client Error/)).toBeInTheDocument();
    });

    it('displays 5xx error classification', () => {
      render(
        <HistoryError
          kind="server"
          message="HTTP 503: Service Unavailable"
          statusCode={503}
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByText(/HTTP 503.*Server Error/)).toBeInTheDocument();
    });
  });

  describe('configuration error', () => {
    it('renders configuration error with appropriate title', () => {
      render(
        <HistoryError
          kind="configuration"
          message="INDEXER_URL is not configured"
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByText('Configuration Error')).toBeInTheDocument();
      expect(screen.getByText(/not properly configured/)).toBeInTheDocument();
    });

    it('displays configuration error message in code block', () => {
      const message = 'INDEXER_URL is not configured';
      render(<HistoryError kind="configuration" message={message} onRetry={jest.fn()} />);

      expect(screen.getByText(message)).toBeInTheDocument();
    });
  });

  describe('unknown error', () => {
    it('renders unknown error with generic title', () => {
      render(<HistoryError kind="unknown" message="Something went wrong" onRetry={jest.fn()} />);

      expect(screen.getByText('Error Loading Transactions')).toBeInTheDocument();
      expect(screen.getByText(/unexpected error/)).toBeInTheDocument();
    });
  });

  describe('retry button', () => {
    it('disables retry button when isRetrying is true', () => {
      render(
        <HistoryError
          kind="network"
          message="Network error"
          onRetry={jest.fn()}
          isRetrying={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Retrying…');
    });

    it('enables retry button when isRetrying is false', () => {
      render(
        <HistoryError
          kind="network"
          message="Network error"
          onRetry={jest.fn()}
          isRetrying={false}
        />
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Retry');
    });

    it('calls onRetry when button is clicked', () => {
      const onRetry = jest.fn();
      render(<HistoryError kind="network" message="Network error" onRetry={onRetry} />);

      screen.getByRole('button').click();
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has role="alert" for error announcement', () => {
      const { container } = render(
        <HistoryError kind="network" message="Network error" onRetry={jest.fn()} />
      );

      expect(container.querySelector('[role="alert"]')).toBeInTheDocument();
    });

    it('has aria-live="polite" for dynamic updates', () => {
      const { container } = render(
        <HistoryError kind="network" message="Network error" onRetry={jest.fn()} />
      );

      expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument();
    });

    it('has descriptive aria-label on retry button', () => {
      render(<HistoryError kind="network" message="Network error" onRetry={jest.fn()} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label');
    });

    it('updates aria-label when retrying', () => {
      const { rerender } = render(
        <HistoryError
          kind="network"
          message="Network error"
          onRetry={jest.fn()}
          isRetrying={false}
        />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Retry loading transactions'
      );

      rerender(
        <HistoryError
          kind="network"
          message="Network error"
          onRetry={jest.fn()}
          isRetrying={true}
        />
      );

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Retrying...');
    });
  });

  describe('styling', () => {
    it('applies error styling classes', () => {
      const { container } = render(
        <HistoryError kind="network" message="Network error" onRetry={jest.fn()} />
      );

      const section = container.querySelector('section');
      expect(section).toHaveClass('bg-red-50', 'border-red-200');
    });

    it('applies button styling classes', () => {
      render(<HistoryError kind="network" message="Network error" onRetry={jest.fn()} />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-600', 'text-white');
    });
  });
});
