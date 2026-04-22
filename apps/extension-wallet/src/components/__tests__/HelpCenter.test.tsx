import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HelpCenter } from '../HelpCenter';

describe('HelpCenter', () => {
  it('renders and filters content by search query', async () => {
    const user = userEvent.setup();
    render(<HelpCenter open onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /find answers quickly/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /features/i }));

    const input = screen.getByPlaceholderText(/search topics/i);
    await user.type(input, 'session');

    expect(screen.getByRole('heading', { name: /session keys/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(<HelpCenter open={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
