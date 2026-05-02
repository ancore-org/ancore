import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TableDensityProvider, useTableDensity } from '../TableDensityContext';

const TestComponent: React.FC = () => {
  const { density, toggleDensity, setDensity } = useTableDensity();

  return (
    <div>
      <span data-testid="density">{density}</span>
      <button onClick={toggleDensity}>Toggle</button>
      <button onClick={() => setDensity('comfortable')}>Set Comfortable</button>
      <button onClick={() => setDensity('compact')}>Set Compact</button>
    </div>
  );
};

describe('TableDensityContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should provide default density as comfortable', () => {
    render(
      <TableDensityProvider>
        <TestComponent />
      </TableDensityProvider>
    );

    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });

  it('should toggle density between comfortable and compact', () => {
    render(
      <TableDensityProvider>
        <TestComponent />
      </TableDensityProvider>
    );

    const toggleButton = screen.getByText('Toggle');

    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');

    fireEvent.click(toggleButton);
    expect(screen.getByTestId('density')).toHaveTextContent('compact');

    fireEvent.click(toggleButton);
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });

  it('should set density directly', () => {
    render(
      <TableDensityProvider>
        <TestComponent />
      </TableDensityProvider>
    );

    fireEvent.click(screen.getByText('Set Compact'));
    expect(screen.getByTestId('density')).toHaveTextContent('compact');

    fireEvent.click(screen.getByText('Set Comfortable'));
    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });

  it('should persist density to localStorage', async () => {
    render(
      <TableDensityProvider>
        <TestComponent />
      </TableDensityProvider>
    );

    fireEvent.click(screen.getByText('Set Compact'));

    await waitFor(() => {
      expect(localStorage.getItem('ancore-dashboard-table-density')).toBe('compact');
    });
  });

  it('should restore density from localStorage', () => {
    localStorage.setItem('ancore-dashboard-table-density', 'compact');

    render(
      <TableDensityProvider>
        <TestComponent />
      </TableDensityProvider>
    );

    expect(screen.getByTestId('density')).toHaveTextContent('compact');
  });

  it('should handle invalid localStorage values gracefully', () => {
    localStorage.setItem('ancore-dashboard-table-density', 'invalid-value');

    render(
      <TableDensityProvider>
        <TestComponent />
      </TableDensityProvider>
    );

    expect(screen.getByTestId('density')).toHaveTextContent('comfortable');
  });

  it('should throw error when useTableDensity is used outside provider', () => {
    const BrokenComponent: React.FC = () => {
      useTableDensity();
      return <div>Should not render</div>;
    };

    expect(() => render(<BrokenComponent />)).toThrow(
      'useTableDensity must be used within a TableDensityProvider'
    );
  });
});
