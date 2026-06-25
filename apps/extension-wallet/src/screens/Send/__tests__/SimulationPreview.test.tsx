import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SimulationPreview, type SimulationState } from '../SimulationPreview';

describe('SimulationPreview', () => {
  it('renders loading state', () => {
    const simulation: SimulationState = { status: 'loading' };
    render(<SimulationPreview simulation={simulation} />);
    expect(screen.getByTestId('simulation-loading')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const simulation: SimulationState = {
      status: 'error',
      message: 'HostError: contract trapped',
    };
    render(<SimulationPreview simulation={simulation} />);
    expect(screen.getByTestId('simulation-error')).toHaveTextContent('HostError: contract trapped');
  });

  it('renders success state with fee, auth entries, and footprint', () => {
    const simulation: SimulationState = {
      status: 'success',
      simulatedFee: '0.0000600',
      outcome: 'success',
      authEntries: ['AAAAAuthEntryXDR'],
      footprint: 'AAAAFootprintXDR',
      resourceLimits: { cpuInsn: 12000, memBytes: 2048 },
    };

    render(<SimulationPreview simulation={simulation} />);

    expect(screen.getByTestId('simulation-success')).toBeInTheDocument();
    expect(screen.getByTestId('simulated-fee')).toHaveTextContent('0.0000600 XLM');
    expect(screen.getByTestId('simulation-auth-entries')).toHaveTextContent('Auth Entries (1)');
    expect(screen.getByTestId('simulation-footprint')).toHaveTextContent('Footprint');
  });
});
