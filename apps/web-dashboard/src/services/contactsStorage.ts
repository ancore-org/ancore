/**
 * contactsStorage — pure localStorage helpers for contact management.
 *
 * All functions are stateless and side-effect-free except for explicit
 * `saveContacts` calls. This makes them straightforward to unit test without
 * mocking React state.
 */

import type { Contact, ContactPayload } from '../types/contacts';

export const CONTACTS_STORAGE_KEY = 'ancore-dashboard-contacts';

// ── Error ─────────────────────────────────────────────────────────────────────

export class DuplicateAliasError extends Error {
  constructor(alias: string) {
    super(`A contact with alias "${alias}" already exists`);
    this.name = 'DuplicateAliasError';
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────

/** Stellar public key: G + 55 uppercase alphanumeric chars */
export function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

/** Alias: 1–32 chars, letters/numbers/spaces/hyphens/underscores */
export function isValidAlias(alias: string): boolean {
  return /^[a-zA-Z0-9 _-]{1,32}$/.test(alias.trim());
}

// ── localStorage persistence ──────────────────────────────────────────────────

export function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

export function saveContacts(contacts: Contact[]): void {
  try {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  } catch {
    // localStorage unavailable (e.g. private browsing quota exceeded)
  }
}

// ── Pure mutation helpers ────────────────────────────────────────────────────

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Add a new contact to the list.
 * Throws DuplicateAliasError if the alias already exists (case-insensitive).
 */
export function addContact(
  contacts: Contact[],
  payload: ContactPayload
): { updated: Contact[]; contact: Contact } {
  const alias = payload.alias.trim();

  if (contacts.some((c) => c.alias.toLowerCase() === alias.toLowerCase())) {
    throw new DuplicateAliasError(alias);
  }

  const contact: Contact = {
    id: generateId(),
    alias,
    address: payload.address,
    isFavorite: payload.isFavorite ?? false,
    createdAt: Date.now(),
  };

  return { updated: [...contacts, contact], contact };
}

/**
 * Update a contact by id. Returns the updated list and the updated contact.
 * Throws DuplicateAliasError if the new alias conflicts with another contact.
 * Returns `{ updated: contacts, contact: undefined }` if id is not found.
 */
export function updateContact(
  contacts: Contact[],
  id: string,
  patch: Partial<ContactPayload>
): { updated: Contact[]; contact: Contact | undefined } {
  const existing = contacts.find((c) => c.id === id);
  if (!existing) return { updated: contacts, contact: undefined };

  if (patch.alias !== undefined) {
    const alias = patch.alias.trim();
    if (contacts.some((c) => c.id !== id && c.alias.toLowerCase() === alias.toLowerCase())) {
      throw new DuplicateAliasError(alias);
    }
    patch = { ...patch, alias };
  }

  const updated: Contact = { ...existing, ...patch, updatedAt: Date.now() };
  return {
    updated: contacts.map((c) => (c.id === id ? updated : c)),
    contact: updated,
  };
}

/** Remove a contact by id. */
export function removeContact(contacts: Contact[], id: string): Contact[] {
  return contacts.filter((c) => c.id !== id);
}

/** Toggle the isFavorite flag for a contact. */
export function toggleFavorite(contacts: Contact[], id: string): Contact[] {
  return contacts.map((c) =>
    c.id === id ? { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() } : c
  );
}
