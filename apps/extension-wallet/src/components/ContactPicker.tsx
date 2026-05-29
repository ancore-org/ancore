import React, { useState } from 'react';
import { useContactsStore } from '../stores/contacts';
import type { Contact } from '@ancore/types';

interface ContactPickerProps {
  /** Called when the user selects a contact from the list. */
  onSelect: (contact: Contact) => void;
  /** Optional placeholder text for the search input. */
  placeholder?: string;
}

/**
 * ContactPicker — inline component that lets the user search saved contacts
 * and favorites to populate the recipient field in the Send flow.
 *
 * Renders favorites first, then remaining contacts ordered by alias.
 */
export function ContactPicker({ onSelect, placeholder = 'Search contacts…' }: ContactPickerProps) {
  const contacts = useContactsStore((state) => state.contacts);
  const [query, setQuery] = useState('');

  const filtered = contacts
    .filter(
      (c) =>
        c.alias.toLowerCase().includes(query.toLowerCase()) ||
        c.address.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      // Favorites first
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.alias.localeCompare(b.alias);
    });

  if (contacts.length === 0) {
    return (
      <div
        data-testid="contact-picker-empty"
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-500"
      >
        No saved contacts yet.
      </div>
    );
  }

  return (
    <div data-testid="contact-picker" className="flex flex-col gap-3">
      <input
        data-testid="contact-picker-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-cyan-400 focus:outline-none transition-all placeholder:text-slate-600"
        autoComplete="off"
        spellCheck={false}
      />

      {filtered.length === 0 ? (
        <div
          data-testid="contact-picker-no-results"
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-sm text-slate-500"
        >
          No contacts match your search.
        </div>
      ) : (
        <ul className="flex flex-col gap-1" role="listbox" aria-label="Contacts">
          {filtered.map((contact) => (
            <li key={contact.id} role="option" aria-selected={false}>
              <button
                type="button"
                data-testid={`contact-item-${contact.id}`}
                onClick={() => onSelect(contact)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:border-cyan-400/40 hover:bg-cyan-400/5 transition-all"
              >
                <div className="flex flex-col min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                    {contact.isFavorite && (
                      <span aria-label="Favorite" className="text-yellow-400 text-xs">
                        ★
                      </span>
                    )}
                    {contact.alias}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono truncate">
                    {contact.address.slice(0, 8)}…{contact.address.slice(-6)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-cyan-400 font-bold uppercase tracking-widest">
                  Use
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
