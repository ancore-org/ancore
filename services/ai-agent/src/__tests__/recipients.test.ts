import type { HandleResolver } from '@ancore/types';
import {
  getIntentRecipient,
  RecipientResolutionError,
  resolveIntentRecipient,
} from '../recipients';
import type { Intent } from '../schemas/intent';
import {
  RESOLVED_ADDRESS,
  UNRESOLVABLE_HANDLE,
  VALID_ADDRESS,
  VALID_HANDLE,
} from './fixtures/addresses';

/** Resolver that knows exactly one handle; anything else is "not found". */
const resolver: HandleResolver = async (handle) =>
  handle === VALID_HANDLE ? { handle, accountAddress: RESOLVED_ADDRESS } : null;

const futureDate = new Date(Date.now() + 86_400_000).toISOString();

function payment(destination: string): Intent {
  return { type: 'payment', amount: '10', asset: 'XLM', destination };
}

function invoice(recipient: string): Intent {
  return { type: 'invoice', amount: '10', asset: 'XLM', recipient, dueDate: futureDate };
}

describe('getIntentRecipient', () => {
  it('reads the field that carries the recipient for each intent type', () => {
    expect(getIntentRecipient(payment(VALID_ADDRESS))).toBe(VALID_ADDRESS);
    expect(getIntentRecipient(invoice(VALID_ADDRESS))).toBe(VALID_ADDRESS);
  });
});

describe('resolveIntentRecipient', () => {
  it('returns an address-bearing payment intent untouched', async () => {
    const intent = payment(VALID_ADDRESS);
    const resolved = await resolveIntentRecipient(intent, resolver);

    expect(resolved).toBe(intent);
  });

  it('does not call the resolver when the recipient is already an address', async () => {
    const spy = jest.fn(resolver);
    await resolveIntentRecipient(payment(VALID_ADDRESS), spy);

    expect(spy).not.toHaveBeenCalled();
  });

  it('replaces a payment handle with the resolved address and records provenance', async () => {
    const resolved = await resolveIntentRecipient(payment(VALID_HANDLE), resolver);

    expect(resolved.type).toBe('payment');
    if (resolved.type === 'payment') {
      expect(resolved.destination).toBe(RESOLVED_ADDRESS);
      expect(resolved.resolvedFrom).toBe(VALID_HANDLE);
    }
  });

  it('replaces an invoice handle in `recipient`, not in `destination`', async () => {
    const resolved = await resolveIntentRecipient(invoice(VALID_HANDLE), resolver);

    expect(resolved.type).toBe('invoice');
    if (resolved.type === 'invoice') {
      expect(resolved.recipient).toBe(RESOLVED_ADDRESS);
      expect(resolved.resolvedFrom).toBe(VALID_HANDLE);
    }
  });

  it('normalises the handle before resolving it', async () => {
    const spy = jest.fn(resolver);
    await resolveIntentRecipient(payment('@ALICE'), spy);

    // normalizeUsernameHandle (@ancore/types) lowercases, so the resolver and
    // the recorded provenance both see the canonical form.
    expect(spy).toHaveBeenCalledWith(VALID_HANDLE);
  });

  it('throws when the handle does not resolve', async () => {
    await expect(resolveIntentRecipient(payment(UNRESOLVABLE_HANDLE), resolver)).rejects.toThrow(
      RecipientResolutionError
    );
  });

  it('names the field in the error so the route can classify it', async () => {
    await expect(resolveIntentRecipient(payment(UNRESOLVABLE_HANDLE), resolver)).rejects.toThrow(
      /destination/i
    );
    await expect(resolveIntentRecipient(invoice(UNRESOLVABLE_HANDLE), resolver)).rejects.toThrow(
      /recipient/i
    );
  });

  it('rejects a handle when no resolver is configured', async () => {
    await expect(resolveIntentRecipient(payment(VALID_HANDLE), null)).rejects.toThrow(
      /no handle resolver is configured/
    );
  });

  it('passes an address through even with no resolver configured', async () => {
    await expect(resolveIntentRecipient(payment(VALID_ADDRESS), null)).resolves.toBeDefined();
  });

  it('propagates a resolver transport failure rather than treating it as not-found', async () => {
    const failing: HandleResolver = async () => {
      throw new Error('Unable to resolve handle');
    };

    // A 500 from the resolver must not be silently downgraded into "this
    // handle does not exist" — the two mean very different things.
    await expect(resolveIntentRecipient(payment(VALID_HANDLE), failing)).rejects.toThrow(
      'Unable to resolve handle'
    );
  });
});
