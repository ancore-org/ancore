import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addContact,
  updateContact,
  removeContact,
  toggleFavorite,
  loadContacts,
  saveContacts,
  DuplicateAliasError,
  CONTACTS_STORAGE_KEY,
  isValidStellarAddress,
  isValidAlias,
} from '../../services/contactsStorage';
import type { Contact } from '../../types/contacts';

const ADDR_A = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA';
const ADDR_B = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';

// ── localStorage mock ─────────────────────────────────────────────────────────

let store: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContact(overrides?: Partial<Contact>): Contact {
  return {
    id: 'test-id-1',
    alias: 'Alice',
    address: ADDR_A,
    isFavorite: false,
    createdAt: 1000,
    ...overrides,
  };
}

// ── Validation helpers ────────────────────────────────────────────────────────

describe('isValidStellarAddress', () => {
  it('accepts valid Stellar addresses', () => {
    expect(isValidStellarAddress(ADDR_A)).toBe(true);
  });

  it('rejects addresses not starting with G', () => {
    expect(isValidStellarAddress('BAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA')).toBe(
      false
    );
  });

  it('rejects short addresses', () => {
    expect(isValidStellarAddress('GABC')).toBe(false);
  });
});

describe('isValidAlias', () => {
  it('accepts simple aliases', () => {
    expect(isValidAlias('Alice')).toBe(true);
    expect(isValidAlias('My Friend')).toBe(true);
    expect(isValidAlias('bob_123')).toBe(true);
    expect(isValidAlias('alice-pay')).toBe(true);
  });

  it('rejects empty aliases', () => {
    expect(isValidAlias('')).toBe(false);
    expect(isValidAlias('   ')).toBe(false);
  });

  it('rejects aliases with special characters', () => {
    expect(isValidAlias('alice@pay')).toBe(false);
    expect(isValidAlias('alice!')).toBe(false);
  });
});

// ── localStorage I/O ──────────────────────────────────────────────────────────

describe('loadContacts / saveContacts', () => {
  beforeEach(() => {
    store = {};
  });

  it('returns empty array when storage is empty', () => {
    expect(loadContacts()).toEqual([]);
  });

  it('roundtrips contacts through localStorage', () => {
    const contacts = [makeContact()];
    saveContacts(contacts);
    expect(loadContacts()).toEqual(contacts);
  });

  it('returns empty array on corrupted JSON', () => {
    store[CONTACTS_STORAGE_KEY] = 'not-valid-json{{{';
    expect(loadContacts()).toEqual([]);
  });
});

// ── addContact ────────────────────────────────────────────────────────────────

describe('addContact', () => {
  it('adds a contact to an empty list', () => {
    const { updated, contact } = addContact([], { alias: 'Alice', address: ADDR_A });
    expect(updated).toHaveLength(1);
    expect(contact.alias).toBe('Alice');
    expect(contact.address).toBe(ADDR_A);
    expect(contact.isFavorite).toBe(false);
  });

  it('assigns an id and createdAt', () => {
    const { contact } = addContact([], { alias: 'Alice', address: ADDR_A });
    expect(typeof contact.id).toBe('string');
    expect(contact.id.length).toBeGreaterThan(0);
    expect(contact.createdAt).toBeGreaterThan(0);
  });

  it('respects isFavorite flag', () => {
    const { contact } = addContact([], { alias: 'Alice', address: ADDR_A, isFavorite: true });
    expect(contact.isFavorite).toBe(true);
  });

  it('throws DuplicateAliasError for duplicate alias (case-insensitive)', () => {
    const existing = [makeContact({ alias: 'Alice' })];
    expect(() => addContact(existing, { alias: 'alice', address: ADDR_B })).toThrow(
      DuplicateAliasError
    );
  });

  it('allows same address with different alias', () => {
    const existing = [makeContact({ alias: 'Alice' })];
    const { updated } = addContact(existing, { alias: 'Alice2', address: ADDR_A });
    expect(updated).toHaveLength(2);
  });

  it('does not mutate the input array', () => {
    const original: Contact[] = [];
    addContact(original, { alias: 'Alice', address: ADDR_A });
    expect(original).toHaveLength(0);
  });
});

// ── updateContact ─────────────────────────────────────────────────────────────

describe('updateContact', () => {
  it('updates alias', () => {
    const existing = [makeContact({ id: '1', alias: 'Alice' })];
    const { contact } = updateContact(existing, '1', { alias: 'Alicia' });
    expect(contact?.alias).toBe('Alicia');
  });

  it('sets updatedAt on edit', () => {
    const existing = [makeContact({ id: '1' })];
    const { contact } = updateContact(existing, '1', { alias: 'NewName' });
    expect(contact?.updatedAt).toBeDefined();
  });

  it('throws DuplicateAliasError when renaming to existing alias', () => {
    const existing = [
      makeContact({ id: '1', alias: 'Alice' }),
      makeContact({ id: '2', alias: 'Bob', address: ADDR_B }),
    ];
    expect(() => updateContact(existing, '2', { alias: 'Alice' })).toThrow(DuplicateAliasError);
  });

  it('returns undefined contact for unknown id', () => {
    const { contact } = updateContact([], 'unknown', { alias: 'X' });
    expect(contact).toBeUndefined();
  });

  it('does not mutate the input array', () => {
    const existing = [makeContact({ id: '1' })];
    const snap = JSON.stringify(existing);
    updateContact(existing, '1', { alias: 'Changed' });
    expect(JSON.stringify(existing)).toBe(snap);
  });
});

// ── removeContact ─────────────────────────────────────────────────────────────

describe('removeContact', () => {
  it('removes a contact by id', () => {
    const existing = [
      makeContact({ id: '1' }),
      makeContact({ id: '2', alias: 'Bob', address: ADDR_B }),
    ];
    const updated = removeContact(existing, '1');
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('2');
  });

  it('returns the same list for unknown id', () => {
    const existing = [makeContact()];
    const updated = removeContact(existing, 'nonexistent');
    expect(updated).toHaveLength(1);
  });
});

// ── toggleFavorite ────────────────────────────────────────────────────────────

describe('toggleFavorite', () => {
  it('marks unfavorited contact as favorite', () => {
    const existing = [makeContact({ id: '1', isFavorite: false })];
    const updated = toggleFavorite(existing, '1');
    expect(updated[0].isFavorite).toBe(true);
  });

  it('unfavorites a favorited contact', () => {
    const existing = [makeContact({ id: '1', isFavorite: true })];
    const updated = toggleFavorite(existing, '1');
    expect(updated[0].isFavorite).toBe(false);
  });

  it('is a no-op for unknown id', () => {
    const existing = [makeContact({ id: '1', isFavorite: false })];
    const updated = toggleFavorite(existing, 'unknown');
    expect(updated[0].isFavorite).toBe(false);
  });

  it('does not mutate the input array', () => {
    const existing = [makeContact({ id: '1' })];
    toggleFavorite(existing, '1');
    expect(existing[0].isFavorite).toBe(false);
  });
});
