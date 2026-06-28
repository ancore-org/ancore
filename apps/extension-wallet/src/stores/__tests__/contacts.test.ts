import { describe, it, expect, beforeEach } from 'vitest';
import { useContactsStore, DuplicateAliasError } from '../contacts';

const ADDR_A = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA';
const ADDR_B = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

beforeEach(() => {
  useContactsStore.setState({ contacts: [] });
});

describe('useContactsStore — addContact', () => {
  it('adds a contact and returns it', () => {
    const { addContact } = useContactsStore.getState();
    const contact = addContact({ alias: 'Alice', address: ADDR_A });

    expect(contact.alias).toBe('Alice');
    expect(contact.address).toBe(ADDR_A);
    expect(contact.isFavorite).toBe(false);
    expect(typeof contact.id).toBe('string');
    expect(contact.createdAt).toBeGreaterThan(0);
  });

  it('persists the contact in state', () => {
    useContactsStore.getState().addContact({ alias: 'Alice', address: ADDR_A });
    expect(useContactsStore.getState().contacts).toHaveLength(1);
  });

  it('throws DuplicateAliasError for duplicate alias (case-insensitive)', () => {
    const { addContact } = useContactsStore.getState();
    addContact({ alias: 'Alice', address: ADDR_A });
    expect(() => addContact({ alias: 'alice', address: ADDR_B })).toThrow(DuplicateAliasError);
  });

  it('allows contacts with the same address but different aliases', () => {
    const { addContact } = useContactsStore.getState();
    addContact({ alias: 'Alice', address: ADDR_A });
    addContact({ alias: 'Alice2', address: ADDR_A }); // same address, different alias — allowed
    expect(useContactsStore.getState().contacts).toHaveLength(2);
  });

  it('respects isFavorite flag on creation', () => {
    const contact = useContactsStore
      .getState()
      .addContact({ alias: 'Bob', address: ADDR_B, isFavorite: true });
    expect(contact.isFavorite).toBe(true);
  });
});

describe('useContactsStore — updateContact', () => {
  it('updates alias', () => {
    const { addContact, updateContact } = useContactsStore.getState();
    const original = addContact({ alias: 'Alice', address: ADDR_A });
    const updated = updateContact(original.id, { alias: 'Alicia' });

    expect(updated?.alias).toBe('Alicia');
    expect(updated?.address).toBe(ADDR_A); // unchanged
    expect(updated?.updatedAt).toBeDefined();
  });

  it('throws DuplicateAliasError when renaming to existing alias', () => {
    const { addContact, updateContact } = useContactsStore.getState();
    addContact({ alias: 'Alice', address: ADDR_A });
    const bob = addContact({ alias: 'Bob', address: ADDR_B });

    expect(() => updateContact(bob.id, { alias: 'Alice' })).toThrow(DuplicateAliasError);
  });

  it('returns undefined for unknown id', () => {
    const result = useContactsStore.getState().updateContact('nonexistent', { alias: 'X' });
    expect(result).toBeUndefined();
  });
});

describe('useContactsStore — removeContact', () => {
  it('removes a contact by id', () => {
    const { addContact, removeContact } = useContactsStore.getState();
    const contact = addContact({ alias: 'Alice', address: ADDR_A });
    removeContact(contact.id);
    expect(useContactsStore.getState().contacts).toHaveLength(0);
  });

  it('is a no-op for unknown id', () => {
    const { addContact, removeContact } = useContactsStore.getState();
    addContact({ alias: 'Alice', address: ADDR_A });
    removeContact('nonexistent');
    expect(useContactsStore.getState().contacts).toHaveLength(1);
  });
});

describe('useContactsStore — toggleFavorite', () => {
  it('marks an unfavorited contact as favorite', () => {
    const { addContact, toggleFavorite } = useContactsStore.getState();
    const contact = addContact({ alias: 'Alice', address: ADDR_A });
    expect(contact.isFavorite).toBe(false);

    toggleFavorite(contact.id);
    expect(useContactsStore.getState().contacts[0].isFavorite).toBe(true);
  });

  it('unfavorites a favorited contact', () => {
    const { addContact, toggleFavorite } = useContactsStore.getState();
    const contact = addContact({ alias: 'Alice', address: ADDR_A, isFavorite: true });
    toggleFavorite(contact.id);
    expect(useContactsStore.getState().contacts[0].isFavorite).toBe(false);
  });

  it('is a no-op for unknown id', () => {
    const { addContact, toggleFavorite } = useContactsStore.getState();
    addContact({ alias: 'Alice', address: ADDR_A });
    toggleFavorite('nonexistent');
    expect(useContactsStore.getState().contacts[0].isFavorite).toBe(false);
  });
});

describe('useContactsStore — getFavorites', () => {
  it('returns only favorited contacts', () => {
    const { addContact, toggleFavorite, getFavorites } = useContactsStore.getState();
    const alice = addContact({ alias: 'Alice', address: ADDR_A });
    addContact({ alias: 'Bob', address: ADDR_B });
    toggleFavorite(alice.id);

    const favorites = getFavorites();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].alias).toBe('Alice');
  });
});

describe('useContactsStore — getContact', () => {
  it('returns contact by id', () => {
    const { addContact, getContact } = useContactsStore.getState();
    const added = addContact({ alias: 'Alice', address: ADDR_A });
    expect(getContact(added.id)?.alias).toBe('Alice');
  });

  it('returns undefined for unknown id', () => {
    expect(useContactsStore.getState().getContact('unknown')).toBeUndefined();
  });
});

describe('useContactsStore — clear', () => {
  it('removes all contacts', () => {
    const { addContact, clear } = useContactsStore.getState();
    addContact({ alias: 'Alice', address: ADDR_A });
    addContact({ alias: 'Bob', address: ADDR_B });
    clear();
    expect(useContactsStore.getState().contacts).toHaveLength(0);
  });
});
