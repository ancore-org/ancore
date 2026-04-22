import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SessionKeysScreen } from '../SessionKeysScreen';
import { useSessionKeys } from '../../../hooks/useSessionKeys';

vi.mock('../../../hooks/useSessionKeys');

const mockUseSessionKeys = useSessionKeys as unknown as ReturnType<typeof vi.fn>;

describe('SessionKeysScreen Integration', () => {
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
      addSessionKey: vi.fn(async (key) => {
        return { id: '2', ...key };
      }),
      revokeSessionKey: vi.fn(async () => {}),
    });
  });

  it('adds a new session key', async () => {
    render(<SessionKeysScreen />);

    fireEvent.click(screen.getByText('+'));

    const nameInput = screen.getByPlaceholderText('Enter key name');
    fireEvent.change(nameInput, { target: { value: 'New Key' } });

    const permissionCheckbox = screen.getByLabelText('Read');
    fireEvent.click(permissionCheckbox);

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('New Key')).toBeInTheDocument();
    });
  });

  it('revokes a session key', async () => {
    const revokeSessionKey = vi.fn(async () => {});
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

    await waitFor(() => {
      expect(revokeSessionKey).toHaveBeenCalledWith('1');
    });
  });
});
