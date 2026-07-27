import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SplitBillPage } from '../SplitBill';

const mockCreateBill = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../hooks/useSplitBill', () => ({
  useSplitBill: () => ({
    bills: [],
    isLoading: false,
    createBill: mockCreateBill,
    updateParticipant: vi.fn(),
    cancelBill: vi.fn(),
    getBill: vi.fn(),
  }),
}));

const ADDRESS_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ADDRESS_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const CREATOR = 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';

/** Open the create form and fill in the non-participant fields. */
async function openForm(user: ReturnType<typeof userEvent.setup>) {
  render(<SplitBillPage />);
  await user.click(screen.getByRole('button', { name: /new bill/i }));
  await user.type(screen.getByLabelText(/title/i), 'Dinner');
  await user.type(screen.getByLabelText(/your address/i), CREATOR);
}

/** The participants <ul> — scopes queries away from the creator address field. */
function participantList() {
  return screen.getByRole('list');
}

/** Add a second participant row and fill both rows' addresses. */
async function addTwoParticipants(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /add participant/i }));

  const addressFields = within(participantList()).getAllByPlaceholderText('G...');
  await user.type(addressFields[0], ADDRESS_A);
  await user.type(addressFields[1], ADDRESS_B);
}

function shareFields() {
  return within(participantList()).getAllByRole('spinbutton');
}

function submit(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getByRole('button', { name: /create split bill/i }));
}

describe('SplitBill create form — share validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBill.mockReturnValue({ id: 'bill-1' });
  });

  it('blocks submit when amounts do not add up to the bill total', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '100');
    const [a, b] = shareFields();
    await user.type(a, '40');
    await user.type(b, '35');

    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('25 short of the 100 total');
  });

  it('blocks submit when amounts exceed the bill total', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '100');
    const [a, b] = shareFields();
    await user.type(a, '80');
    await user.type(b, '35');

    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('15 over the 100 total');
  });

  it('creates the bill when amounts add up to the total', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '100');
    const [a, b] = shareFields();
    await user.type(a, '60');
    await user.type(b, '40');

    await submit(user);

    expect(mockCreateBill).toHaveBeenCalledTimes(1);
    expect(mockCreateBill.mock.calls[0][0].participants).toEqual([
      expect.objectContaining({ address: ADDRESS_A, amount: '60' }),
      expect.objectContaining({ address: ADDRESS_B, amount: '40' }),
    ]);
  });

  it('creates the bill with no total, preserving the free-entry flow', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    const [a, b] = shareFields();
    await user.type(a, '12');
    await user.type(b, '8');

    await submit(user);

    expect(mockCreateBill).toHaveBeenCalledTimes(1);
  });

  it('blocks submit when percentage shares do not total 100', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: /percentage/i }));
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '200');
    const [a, b] = shareFields();
    await user.type(a, '50');
    await user.type(b, '30');

    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('20% short of 100%');
  });

  it('converts percentage shares to amounts against the bill total', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: /percentage/i }));
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '200');
    const [a, b] = shareFields();
    await user.type(a, '75');
    await user.type(b, '25');

    await submit(user);

    expect(mockCreateBill.mock.calls[0][0].participants).toEqual([
      expect.objectContaining({ amount: '150' }),
      expect.objectContaining({ amount: '50' }),
    ]);
  });

  it('requires a bill total in percentage mode', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: /percentage/i }));
    await addTwoParticipants(user);

    const [a, b] = shareFields();
    await user.type(a, '50');
    await user.type(b, '50');

    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the bill total');
  });

  it('shows an inline error on the offending participant row', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.type(shareFields()[0], '100');
    // Second participant's amount is left blank.

    await submit(user);

    const blankField = shareFields()[1];
    expect(blankField).toHaveAttribute('aria-invalid', 'true');

    const describedBy = blankField.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      'Enter an amount for this participant.'
    );
  });

  it('tracks the running total as shares are entered', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.type(shareFields()[0], '40');

    expect(screen.getByTestId('share-summary')).toHaveTextContent('40 of 100 allocated');

    await user.type(shareFields()[1], '60');

    expect(screen.getByTestId('share-summary')).toHaveTextContent('100 of 100 allocated');
  });

  it('clears stale errors when the split mode changes', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await addTwoParticipants(user);

    await user.type(screen.getByPlaceholderText('100'), '100');
    await user.type(shareFields()[0], '40');
    await submit(user);

    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /percentage/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still enforces the pre-existing address requirement', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(shareFields()[0], '40');
    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('All participants need an address.');
  });

  it('rejects a malformed participant address with an inline error', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(within(participantList()).getByPlaceholderText('G...'), 'not-an-address');
    await user.type(shareFields()[0], '40');
    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Fix the highlighted participant addresses.'
    );
    expect(within(participantList()).getByPlaceholderText('G...')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('rejects a malformed creator address before checking participants', async () => {
    const user = userEvent.setup();
    render(<SplitBillPage />);
    await user.click(screen.getByRole('button', { name: /new bill/i }));
    await user.type(screen.getByLabelText(/title/i), 'Dinner');
    await user.type(screen.getByLabelText(/your address/i), 'GNOTVALID');
    await submit(user);

    expect(mockCreateBill).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/your address/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts a C… smart-account address for a participant', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(
      within(participantList()).getByPlaceholderText('G...'),
      'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE'
    );
    await user.type(shareFields()[0], '40');
    await submit(user);

    expect(mockCreateBill).toHaveBeenCalled();
  });

  it('labels the share column by mode', async () => {
    const user = userEvent.setup();
    await openForm(user);

    const participantList = screen.getByRole('list');
    expect(within(participantList).getByText(/amount \*/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /percentage/i }));

    expect(within(screen.getByRole('list')).getByText(/share % \*/i)).toBeInTheDocument();
  });
});
