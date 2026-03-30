import { render, screen, fireEvent } from '@testing-library/react';
import { SessionKeysScreen } from '../SessionKeysScreen';
import { useSessionKeys } from '../../../hooks/useSessionKeys';
import { vi } from 'vitest';

vi.mock('../../../hooks/useSessionKeys');

const mockUseSessionKeys = useSessionKeys as ReturnType<typeof vi.fn>;

describe('SessionKeysScreen', () => {
  beforeEach(() => {
    mockUseSessionKeys.mockReturnValue({
      sessionKeys: [
        {
          id: '1',
          name: 'Personal Key',
          permissions: ['Read', 'Write'],
          expiry: 'Jan 25, 2026',
        },
      ],
      addSessionKey: vi.fn(),
      revokeSessionKey: vi.fn(),
    });
  });

  it('renders the session keys screen', () => {
    render(<SessionKeysScreen />);

    expect(screen.getByText('Session Keys')).toBeInTheDocument();
    expect(screen.getByText('What are session keys?')).toBeInTheDocument();
    expect(screen.getByText('Personal Key')).toBeInTheDocument();
  });

  it('calls revokeSessionKey when revoke button is clicked', () => {
    const revokeSessionKey = vi.fn();
    mockUseSessionKeys.mockReturnValue({
      sessionKeys: [
        {
          id: '1',
          name: 'Personal Key',
          permissions: ['Read', 'Write'],
          expiry: 'Jan 25, 2026',
        },
      ],
      addSessionKey: vi.fn(),
      revokeSessionKey,
    });

    render(<SessionKeysScreen />);

    fireEvent.click(screen.getByText('Revoke'));

    expect(revokeSessionKey).toHaveBeenCalledWith('1');
  });

  it('opens the add session key dialog when the add button is clicked', () => {
    render(<SessionKeysScreen />);

    fireEvent.click(screen.getByText('+'));

    expect(screen.getByText('Add Session Key')).toBeInTheDocument();
  });
});
