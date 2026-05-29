/**
 * Contact and favorites types for the web-dashboard.
 * Mirrors packages/types/src/contacts.ts — kept local to avoid adding a
 * workspace dependency to the dashboard bundle.
 */

/** A saved recipient contact. */
export interface Contact {
  id: string;
  alias: string;
  address: string;
  isFavorite: boolean;
  createdAt: number;
  updatedAt?: number;
}

/** Payload accepted by addContact / updateContact. */
export interface ContactPayload {
  alias: string;
  address: string;
  isFavorite?: boolean;
}
