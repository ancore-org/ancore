/**
 * Contacts Import/Export Backup Utility (#1453, #1455).
 *
 * Provides capabilities to export contacts as JSON backup files, validate
 * imported JSON structures and Stellar addresses, and safely merge or replace
 * saved contacts in the extension contacts store.
 */

import { assertValidEd25519PublicKey } from '@ancore/core-sdk';
import type { Contact, ContactPayload } from '@ancore/types';
import { useContactsStore } from '../stores/contacts';

export class ContactsIOError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContactsIOError';
  }
}

export interface ContactExportItem {
  alias: string;
  address: string;
  isFavorite?: boolean;
}

export interface ContactBackupFile {
  version: 1;
  exportedAt: string;
  count: number;
  contacts: ContactExportItem[];
}

export interface ImportContactsResult {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Serializes contacts into a canonical JSON backup string.
 */
export function exportContactsAsJSON(contacts?: Contact[]): string {
  const list = contacts ?? useContactsStore.getState().contacts;

  const exportItems: ContactExportItem[] = list.map((c) => ({
    alias: c.alias,
    address: c.address,
    isFavorite: c.isFavorite,
  }));

  const backup: ContactBackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: exportItems.length,
    contacts: exportItems,
  };

  return JSON.stringify(backup, null, 2);
}

/**
 * Triggers browser file download of the exported contacts JSON.
 */
export function downloadContactsBackup(
  contacts?: Contact[],
  filename = 'ancore-contacts-backup.json'
): void {
  const json = exportContactsAsJSON(contacts);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

/**
 * Validates and parses raw JSON backup string into ContactPayload items.
 * Accepts either { version: 1, contacts: [...] } format or direct [...] array.
 */
export function parseContactsJSON(raw: string): ContactPayload[] {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ContactsIOError('Backup JSON cannot be empty');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ContactsIOError('Invalid JSON format');
  }

  let rawList: unknown[];
  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Record<string, unknown>).contacts)
  ) {
    rawList = (parsed as { contacts: unknown[] }).contacts;
  } else {
    throw new ContactsIOError(
      'Invalid contacts backup format: must be an array or contain a "contacts" array'
    );
  }

  const validPayloads: ContactPayload[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      throw new ContactsIOError(`Contact entry at index ${i} must be an object`);
    }

    const { alias, address, isFavorite } = item as Record<string, unknown>;

    if (typeof alias !== 'string' || !alias.trim()) {
      throw new ContactsIOError(`Contact at index ${i} is missing a valid alias`);
    }

    if (typeof address !== 'string' || !address.trim()) {
      throw new ContactsIOError(`Contact "${alias}" is missing a Stellar address`);
    }

    try {
      assertValidEd25519PublicKey(address.trim());
    } catch {
      throw new ContactsIOError(`Contact "${alias}" has an invalid Stellar address: "${address}"`);
    }

    validPayloads.push({
      alias: alias.trim(),
      address: address.trim(),
      isFavorite: typeof isFavorite === 'boolean' ? isFavorite : false,
    });
  }

  return validPayloads;
}

/**
 * Imports contacts from raw JSON, supporting 'merge' (default) and 'replace' modes.
 */
export function importContacts(
  rawJson: string,
  options: { mode?: 'merge' | 'replace' } = {}
): ImportContactsResult {
  const mode = options.mode ?? 'merge';
  const incoming = parseContactsJSON(rawJson);
  const store = useContactsStore.getState();

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  if (mode === 'replace') {
    store.clear();
    for (const item of incoming) {
      try {
        store.addContact(item);
        imported++;
      } catch {
        skipped++;
      }
    }
  } else {
    // Merge mode: update existing by alias, or add new
    for (const item of incoming) {
      const existing = store.contacts.find(
        (c) => c.alias.toLowerCase() === item.alias.toLowerCase()
      );

      if (existing) {
        if (existing.address !== item.address || existing.isFavorite !== item.isFavorite) {
          store.updateContact(existing.id, {
            address: item.address,
            isFavorite: item.isFavorite,
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        try {
          store.addContact(item);
          imported++;
        } catch {
          skipped++;
        }
      }
    }
  }

  return {
    imported,
    updated,
    skipped,
    total: incoming.length,
  };
}
