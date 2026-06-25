import { useState, useCallback, useEffect } from 'react';
import type { Contact, ContactPayload } from '../types/contacts';
import {
  loadContacts,
  saveContacts,
  addContact as storageAddContact,
  updateContact as storageUpdateContact,
  removeContact as storageRemoveContact,
  toggleFavorite as storageToggleFavorite,
  DuplicateAliasError,
} from '../services/contactsStorage';

export { DuplicateAliasError } from '../services/contactsStorage';

export interface UseContactsReturn {
  contacts: Contact[];
  favorites: Contact[];

  addContact: (payload: ContactPayload) => Contact;
  updateContact: (id: string, patch: Partial<ContactPayload>) => Contact | undefined;
  removeContact: (id: string) => void;
  toggleFavorite: (id: string) => void;
  getContact: (id: string) => Contact | undefined;

  /** True while contacts are being loaded from storage on mount. */
  isLoading: boolean;
  /** Non-null if a mutation threw an error (cleared on next mutation). */
  error: Error | null;
}

/**
 * useContacts — React hook for managing saved recipient contacts in the
 * web-dashboard. Persists contacts to localStorage.
 *
 * Mirrors the interface of the extension-wallet Zustand contacts store so
 * consuming components can be shared or easily ported between apps.
 */
export function useContacts(): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setContacts(loadContacts());
    setIsLoading(false);
  }, []);

  const addContact = useCallback((payload: ContactPayload): Contact => {
    setError(null);
    const { updated, contact } = storageAddContact(loadContacts(), payload);
    saveContacts(updated);
    setContacts(updated);
    return contact;
  }, []);

  const updateContact = useCallback(
    (id: string, patch: Partial<ContactPayload>): Contact | undefined => {
      setError(null);
      try {
        const { updated, contact } = storageUpdateContact(loadContacts(), id, patch);
        saveContacts(updated);
        setContacts(updated);
        return contact;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    []
  );

  const removeContact = useCallback((id: string): void => {
    setError(null);
    const updated = storageRemoveContact(loadContacts(), id);
    saveContacts(updated);
    setContacts(updated);
  }, []);

  const toggleFavorite = useCallback((id: string): void => {
    setError(null);
    const updated = storageToggleFavorite(loadContacts(), id);
    saveContacts(updated);
    setContacts(updated);
  }, []);

  const getContact = useCallback(
    (id: string): Contact | undefined => {
      return contacts.find((c) => c.id === id);
    },
    [contacts]
  );

  const favorites = contacts.filter((c) => c.isFavorite);

  return {
    contacts,
    favorites,
    addContact,
    updateContact,
    removeContact,
    toggleFavorite,
    getContact,
    isLoading,
    error,
  };
}
