import { describe, it, expect } from 'vitest';
import {
  extractTranslationKeys,
  flattenLocaleKeys,
  findMissingTranslationKeys,
  findHardcodedUserStrings,
  findHardcodedViolations,
  lintTranslations,
} from '../../../scripts/lint-translations.mjs';

describe('lint-translations', () => {
  it('extracts static t() keys from source', () => {
    const source = `
      const { t } = useTranslation();
      t('settings.title');
      t("settings.subtitle");
      t(\`settings.dynamic.\${value}\`);
    `;

    expect([...extractTranslationKeys(source)].sort()).toEqual([
      'settings.subtitle',
      'settings.title',
    ]);
  });

  it('returns no keys for empty source', () => {
    expect(extractTranslationKeys('')).toEqual(new Set());
  });

  it('flattens nested locale JSON', () => {
    const keys = flattenLocaleKeys({
      settings: {
        title: 'Settings',
        network: {
          testnet: 'Testnet',
        },
      },
    });

    expect(keys.has('settings.title')).toBe(true);
    expect(keys.has('settings.network.testnet')).toBe(true);
    expect(keys.size).toBe(2);
  });

  it('reports missing keys used in source', () => {
    const locale = {
      settings: {
        title: 'Settings',
      },
    };

    const missing = findMissingTranslationKeys(
      ["t('settings.title'); t('settings.missing');"],
      locale
    );

    expect(missing).toEqual(['settings.missing']);
  });

  it('passes when all used keys exist in locale', () => {
    const locale = {
      settings: {
        title: 'Settings',
        subtitle: 'Manage your wallet preferences',
      },
    };

    expect(
      findMissingTranslationKeys(["t('settings.title'); t('settings.subtitle');"], locale)
    ).toEqual([]);
  });

  it('flags hardcoded i18n-sensitive props in enforced files', () => {
    const violations = findHardcodedUserStrings(
      '<SettingItem label="Change Password" description="Update password" />',
      'Example.tsx'
    );

    expect(violations).toHaveLength(2);
    expect(violations[0].kind).toBe('prop');
  });

  it('allows single-character JSX placeholders', () => {
    const violations = findHardcodedUserStrings('<div>A</div>', 'Example.tsx');
    expect(violations).toHaveLength(0);
  });

  it('detects hardcoded JSX text in enforced tsx files', () => {
    const violations = findHardcodedUserStrings('<h1>Settings</h1>', 'Example.tsx');
    expect(violations.some((v) => v.kind === 'jsx-text')).toBe(true);
  });

  it('passes hardcoded scan on migrated settings files', () => {
    expect(findHardcodedViolations()).toEqual([]);
  });

  it('passes against the extension source tree', () => {
    const { ok, missingKeys, hardcodedViolations } = lintTranslations();
    expect(ok).toBe(true);
    expect(missingKeys).toEqual([]);
    expect(hardcodedViolations).toEqual([]);
  });
});
