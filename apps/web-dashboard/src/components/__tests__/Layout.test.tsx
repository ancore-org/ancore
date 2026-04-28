import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from '../Layout';
import { TableDensityProvider } from '../../contexts/TableDensityContext';

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <BrowserRouter>
      <TableDensityProvider>{component}</TableDensityProvider>
    </BrowserRouter>
  );
};

describe('Layout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should render navigation links', () => {
    renderWithProviders(<Layout />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('should render the Ancore brand', () => {
    renderWithProviders(<Layout />);

    expect(screen.getByText('Ancore')).toBeInTheDocument();
  });

  it('should render density toggle button', () => {
    renderWithProviders(<Layout />);

    expect(screen.getByTitle(/Switch to/i)).toBeInTheDocument();
  });

  it('should toggle density when button is clicked', () => {
    renderWithProviders(<Layout />);

    const toggleButton = screen.getByTitle(/Switch to/i);

    // Should start with comfortable
    expect(screen.getByText('comfortable')).toBeInTheDocument();

    fireEvent.click(toggleButton);

    // Should now show compact
    expect(screen.getByText('compact')).toBeInTheDocument();
    expect(screen.getByTitle(/Switch to comfortable/i)).toBeInTheDocument();
  });

  it('should persist density preference across component remounts', () => {
    const { unmount } = renderWithProviders(<Layout />);

    const toggleButton = screen.getByTitle(/Switch to/i);
    fireEvent.click(toggleButton);

    expect(screen.getByText('compact')).toBeInTheDocument();

    unmount();

    // Re-render should restore from localStorage
    renderWithProviders(<Layout />);
    expect(screen.getByText('compact')).toBeInTheDocument();
  });
});
