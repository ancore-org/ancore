/**
 * Contacts Store (Zustand)
 *
 * Manages saved recipient contacts with persistence to extension storage.
 * Enforces alias uniqueness and provides favorites management.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';
import type { Contact, ContactPayload } from '@ancore/types';

// ── Errors ────────────────────────────────────────────────────────────────────

export class DuplicateAliasError extends Error {
  constructor(alias: string) {
    super(`A contact with alias "${alias}" already exists`);
    this.name = 'DuplicateAliasError';
  }
}

// ── State interface ───────────────────────────────────────────────────────────

export interface ContactsState {
  contacts: Contact[];

  /** Add a new contact. Throws DuplicateAliasError if the alias already exists. */
  addContact: (payload: ContactPayload) => Contact;

  /**
   * Update an existing contact by id.
   * Throws DuplicateAliasError if the new alias conflicts with another contact.
   * Returns the updated contact, or undefined if not found.
   */
  updateContact: (id: string, patch: Partial<ContactPayload>) => Contact | undefined;

  /** Remove a contact by id. No-op if not found. */
  removeContact: (id: string) => void;

  /** Toggle the isFavorite flag for a contact. No-op if not found. */
  toggleFavorite: (id: string) => void;

  /** Get a contact by id. */
  getContact: (id: string) => Contact | undefined;

  /** Get all contacts marked as favorites, in creation order. */
  getFavorites: () => Contact[];

  /** Clear all contacts. */
  clear: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  // Use crypto.randomUUID if available (modern browsers / Node 14.17+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + random hex
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useContactsStore = create<ContactsState>()(
  persist(
    (set, get) => ({
      contacts: [],

      addContact: (payload: ContactPayload): Contact => {
        const { contacts } = get();
        const normalizedAlias = payload.alias.trim();

        if (contacts.some((c) => c.alias.toLowerCase() === normalizedAlias.toLowerCase())) {
          throw new DuplicateAliasError(normalizedAlias);
        }

        const now = Date.now();
        const contact: Contact = {
          id: generateId(),
          alias: normalizedAlias,
          address: payload.address,
          isFavorite: payload.isFavorite ?? false,
          createdAt: now,
        };

        set((state) => ({ contacts: [...state.contacts, contact] }));
        return contact;
      },

      updateContact: (id: string, patch: Partial<ContactPayload>): Contact | undefined => {
        const { contacts } = get();
        const existing = contacts.find((c) => c.id === id);
        if (!existing) return undefined;

        if (patch.alias !== undefined) {
          const normalizedAlias = patch.alias.trim();
          const conflictingAlias = contacts.some(
            (c) => c.id !== id && c.alias.toLowerCase() === normalizedAlias.toLowerCase()
          );
          if (conflictingAlias) {
            throw new DuplicateAliasError(normalizedAlias);
          }
          patch = { ...patch, alias: normalizedAlias };
        }

        const updated: Contact = {
          ...existing,
          ...patch,
          updatedAt: Date.now(),
        };

        set((state) => ({
          contacts: state.contacts.map((c) => (c.id === id ? updated : c)),
        }));

        return updated;
      },

      removeContact: (id: string): void => {
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== id),
        }));
      },

      toggleFavorite: (id: string): void => {
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() } : c
          ),
        }));
      },

      getContact: (id: string): Contact | undefined => {
        return get().contacts.find((c) => c.id === id);
      },

      getFavorites: (): Contact[] => {
        return get().contacts.filter((c) => c.isFavorite);
      },

      clear: (): void => {
        set({ contacts: [] });
      },
    }),
    {
      name: 'ancore-contacts',
      storage: createJSONStorage(() => extensionStorage),
    }
  )
);

/** Convenience selector — avoids re-renders when unrelated state changes. */
export function getContactsState() {
  return useContactsStore.getState();
}
