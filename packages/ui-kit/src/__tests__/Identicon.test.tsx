import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Identicon } from '@/components/Identicon';

describe('Identicon', () => {
  it('renders an accessible svg identicon', () => {
    render(<Identicon value="GABC123" />);

    expect(screen.getByLabelText('Identicon for address GABC123')).toBeInTheDocument();
  });

  it('renders deterministically for the same value', () => {
    const { container, rerender } = render(<Identicon value="GABC123" />);
    const firstMarkup = container.innerHTML;

    rerender(<Identicon value="GABC123" />);

    expect(container.innerHTML).toBe(firstMarkup);
  });

  it('renders different output for different values', () => {
    const { container, rerender } = render(<Identicon value="GABC123" />);
    const firstMarkup = container.innerHTML;

    rerender(<Identicon value="GDEF456" />);

    expect(container.innerHTML).not.toBe(firstMarkup);
  });

  it('supports a custom label and size', () => {
    render(<Identicon value="GABC123" label="Wallet avatar" size={64} />);

    const identicon = screen.getByLabelText('Wallet avatar');
    expect(identicon).toHaveAttribute('width', '64');
    expect(identicon).toHaveAttribute('height', '64');
  });
});
