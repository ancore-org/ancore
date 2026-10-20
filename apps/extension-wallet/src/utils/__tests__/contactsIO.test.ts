import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportContactsAsJSON,
  parseContactsJSON,
  importContacts,
  ContactsIOError,
} from '../contactsIO';
import { useContactsStore } from '../../stores/contacts';
import type { Contact } from '@ancore/types';

const ADDR_1 = 'GDP27GNQUPVJQ2JRZC5N5YYNLMKNVYF5AJOOKWQ2R4PKAKMMV77O5EIY';
const ADDR_2 = 'GDX7IBH35QYGRVFKSXXYINHDQSKV7SRZ7EFVYYI4USSK66BRSZWDVE5C';
const ADDR_3 = 'GBSDPCBQDSTOCIOOXLYOHF5BYZTRI2MHINMYBJZEVGQ6Y5NNXUIVO6F4';

describe('contactsIO (#1453, #1455)', () => {
  beforeEach(() => {
    useContactsStore.setState({ contacts: [] });
  });

  describe('exportContactsAsJSON', () => {
    it('serializes store contacts into valid JSON backup format', () => {
      useContactsStore.getState().addContact({
        alias: 'Alice',
        address: ADDR_1,
        isFavorite: true,
      });
      useContactsStore.getState().addContact({
        alias: 'Bob',
        address: ADDR_2,
        isFavorite: false,
      });

      const jsonStr = exportContactsAsJSON();
      const parsed = JSON.parse(jsonStr);

      expect(parsed.version).toBe(1);
      expect(parsed.count).toBe(2);
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.contacts).toHaveLength(2);
      expect(parsed.contacts[0]).toEqual({
        alias: 'Alice',
        address: ADDR_1,
        isFavorite: true,
      });
      expect(parsed.contacts[1]).toEqual({
        alias: 'Bob',
        address: ADDR_2,
        isFavorite: false,
      });
    });

    it('allows passing custom contact array', () => {
      const custom: Contact[] = [
        {
          id: 'custom-1',
          alias: 'Charlie',
          address: ADDR_3,
          isFavorite: false,
          createdAt: Date.now(),
        },
      ];

      const jsonStr = exportContactsAsJSON(custom);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.count).toBe(1);
      expect(parsed.contacts[0].alias).toBe('Charlie');
    });
  });

  describe('parseContactsJSON', () => {
    it('parses valid backup file format', () => {
      const payload = {
        version: 1,
        contacts: [
          { alias: 'Alice', address: ADDR_1, isFavorite: true },
          { alias: 'Bob', address: ADDR_2 },
        ],
      };

      const result = parseContactsJSON(JSON.stringify(payload));
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ alias: 'Alice', address: ADDR_1, isFavorite: true });
      expect(result[1]).toEqual({ alias: 'Bob', address: ADDR_2, isFavorite: false });
    });

    it('parses bare array format', () => {
      const payload = [{ alias: 'Charlie', address: ADDR_3, isFavorite: false }];
      const result = parseContactsJSON(JSON.stringify(payload));
      expect(result).toHaveLength(1);
      expect(result[0].alias).toBe('Charlie');
    });

    it('rejects empty or whitespace input', () => {
      expect(() => parseContactsJSON('')).toThrow(ContactsIOError);
      expect(() => parseContactsJSON('   ')).toThrow(ContactsIOError);
    });

    it('rejects malformed JSON', () => {
      expect(() => parseContactsJSON('{ not valid json }')).toThrow(ContactsIOError);
    });

    it('rejects payloads without contacts array', () => {
      expect(() => parseContactsJSON(JSON.stringify({ version: 1 }))).toThrow(ContactsIOError);
    });

    it('rejects contact missing alias or address', () => {
      expect(() => parseContactsJSON(JSON.stringify([{ address: ADDR_1 }]))).toThrow(
        ContactsIOError
      );
      expect(() => parseContactsJSON(JSON.stringify([{ alias: 'Test' }]))).toThrow(ContactsIOError);
    });

    it('rejects invalid Stellar address format', () => {
      expect(() =>
        parseContactsJSON(JSON.stringify([{ alias: 'BadAddress', address: 'not-a-stellar-key' }]))
      ).toThrow(ContactsIOError);
    });
  });

  describe('importContacts', () => {
    it('imports new contacts into the store in merge mode', () => {
      const input = JSON.stringify({
        version: 1,
        contacts: [
          { alias: 'Alice', address: ADDR_1, isFavorite: true },
          { alias: 'Bob', address: ADDR_2 },
        ],
      });

      const stats = importContacts(input);
      expect(stats).toEqual({
        imported: 2,
        updated: 0,
        skipped: 0,
        total: 2,
      });

      const contacts = useContactsStore.getState().contacts;
      expect(contacts).toHaveLength(2);
      expect(contacts.find((c) => c.alias === 'Alice')?.isFavorite).toBe(true);
    });

    it('updates existing contacts when alias matches and attributes changed in merge mode', () => {
      useContactsStore.getState().addContact({
        alias: 'Alice',
        address: ADDR_1,
        isFavorite: false,
      });

      const input = JSON.stringify({
        contacts: [{ alias: 'Alice', address: ADDR_3, isFavorite: true }],
      });

      const stats = importContacts(input, { mode: 'merge' });
      expect(stats.updated).toBe(1);
      expect(stats.imported).toBe(0);

      const alice = useContactsStore.getState().contacts.find((c) => c.alias === 'Alice');
      expect(alice?.address).toBe(ADDR_3);
      expect(alice?.isFavorite).toBe(true);
    });

    it('skips existing contacts with identical data in merge mode', () => {
      useContactsStore.getState().addContact({
        alias: 'Alice',
        address: ADDR_1,
        isFavorite: true,
      });

      const input = JSON.stringify({
        contacts: [{ alias: 'Alice', address: ADDR_1, isFavorite: true }],
      });

      const stats = importContacts(input, { mode: 'merge' });
      expect(stats.skipped).toBe(1);
      expect(stats.imported).toBe(0);
      expect(stats.updated).toBe(0);
    });

    it('replaces all contacts when replace mode is selected', () => {
      useContactsStore.getState().addContact({
        alias: 'OldContact',
        address: ADDR_1,
      });

      const input = JSON.stringify({
        contacts: [
          { alias: 'NewContact1', address: ADDR_2 },
          { alias: 'NewContact2', address: ADDR_3 },
        ],
      });

      const stats = importContacts(input, { mode: 'replace' });
      expect(stats.imported).toBe(2);

      const contacts = useContactsStore.getState().contacts;
      expect(contacts).toHaveLength(2);
      expect(contacts.some((c) => c.alias === 'OldContact')).toBe(false);
      expect(contacts.some((c) => c.alias === 'NewContact1')).toBe(true);
    });

    it('performs clean export and import round-trip', () => {
      useContactsStore.getState().addContact({ alias: 'Alice', address: ADDR_1, isFavorite: true });
      useContactsStore.getState().addContact({ alias: 'Bob', address: ADDR_2, isFavorite: false });

      const exported = exportContactsAsJSON();

      // Clear store
      useContactsStore.getState().clear();
      expect(useContactsStore.getState().contacts).toHaveLength(0);

      // Re-import
      const stats = importContacts(exported, { mode: 'replace' });
      expect(stats.imported).toBe(2);

      const reimported = useContactsStore.getState().contacts;
      expect(reimported).toHaveLength(2);
      expect(reimported[0].alias).toBe('Alice');
      expect(reimported[0].address).toBe(ADDR_1);
      expect(reimported[1].alias).toBe('Bob');
      expect(reimported[1].address).toBe(ADDR_2);
    });
  });
});
