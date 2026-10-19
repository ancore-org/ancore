/* eslint-disable no-script-url */
import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  stripControlCharacters,
  sanitizeString,
  sanitizeUrl,
  sanitizeOrigin,
  sanitizeContractId,
  sanitizeMethodName,
  sanitizePermissions,
  sanitizeDappMetadata,
} from '../sanitize';

describe('sanitize utilities', () => {
  describe('escapeHtml', () => {
    it('escapes dangerous HTML characters', () => {
      const input = '<script>alert("xss")</script>&`\'/';
      const output = escapeHtml(input);
      expect(output).not.toContain('<script>');
      expect(output).toContain('&lt;script&gt;');
      expect(output).toContain('&amp;');
      expect(output).toContain('&quot;');
      expect(output).toContain('&#x27;');
      expect(output).toContain('&#x2F;');
      expect(output).toContain('&#x60;');
    });
  });

  describe('stripControlCharacters', () => {
    it('removes control characters', () => {
      const input = 'hello\x00\x08world\x1F';
      expect(stripControlCharacters(input)).toBe('helloworld');
    });
  });

  describe('sanitizeString', () => {
    it('escapes and truncates string to maxLength', () => {
      const input = '<b>hello</b>'.repeat(20);
      const sanitized = sanitizeString(input, 30);
      expect(sanitized).toContain('&lt;b&gt;');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).not.toContain('<');
    });

    it('handles null and undefined', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('sanitizeUrl', () => {
    it('allows valid https and http urls', () => {
      expect(sanitizeUrl('https://example.com/app')).toBe('https://example.com/app');
      expect(sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000/');
    });

    it('rejects javascript: urls', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('');
      expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBe('');
      expect(sanitizeUrl('   javascript:alert(1)')).toBe('');
    });

    it('rejects data: and vbscript: schemes', () => {
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(sanitizeUrl('vbscript:msgbox("xss")')).toBe('');
    });

    it('rejects file: schemes', () => {
      expect(sanitizeUrl('file:///etc/passwd')).toBe('');
    });

    it('handles malformed urls', () => {
      expect(sanitizeUrl('not a url')).toBe('');
      expect(sanitizeUrl('')).toBe('');
    });
  });

  describe('sanitizeOrigin', () => {
    it('extracts origin from valid URL', () => {
      expect(sanitizeOrigin('https://app.stellar.org/swap')).toBe('https://app.stellar.org');
    });

    it('returns Untrusted origin for dangerous schemes', () => {
      expect(sanitizeOrigin('javascript:alert(1)')).toBe('Untrusted origin');
      expect(sanitizeOrigin('data:text/html;base64,...')).toBe('Untrusted origin');
    });

    it('returns Unknown origin for empty/falsy origin', () => {
      expect(sanitizeOrigin('')).toBe('Unknown origin');
      expect(sanitizeOrigin(null)).toBe('Unknown origin');
    });
  });

  describe('sanitizeContractId', () => {
    it('accepts valid 56-char C... Soroban contract IDs', () => {
      const validId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      expect(sanitizeContractId(validId)).toBe(validId);
    });

    it('rejects invalid contract IDs with script injection or malformed length', () => {
      expect(sanitizeContractId('<script>alert(1)</script>')).toBe('Invalid Contract Address');
      expect(sanitizeContractId('GABC123')).toBe('Invalid Contract Address');
      expect(sanitizeContractId('')).toBe('Invalid Contract Address');
      expect(sanitizeContractId(null)).toBe('Unknown Contract');
    });
  });

  describe('sanitizeMethodName', () => {
    it('accepts valid identifiers', () => {
      expect(sanitizeMethodName('transfer')).toBe('transfer');
      expect(sanitizeMethodName('set_admin')).toBe('set_admin');
      expect(sanitizeMethodName('execute-plan')).toBe('execute-plan');
    });

    it('escapes and cleans malicious method names', () => {
      expect(sanitizeMethodName('<img src=x onerror=alert(1)>')).toContain('&lt;img');
      expect(sanitizeMethodName(null)).toBe('unknown_method');
    });
  });

  describe('sanitizePermissions', () => {
    it('sanitizes list of scopes', () => {
      const scopes = ['read_profile', '<script>alert(1)</script>', 'sign_tx'];
      const result = sanitizePermissions(scopes);
      expect(result).toHaveLength(3);
      expect(result[0]).toBe('read_profile');
      expect(result[1]).toContain('&lt;script&gt;');
      expect(result[2]).toBe('sign_tx');
    });

    it('handles non-array input', () => {
      expect(sanitizePermissions(null)).toEqual([]);
      expect(sanitizePermissions('invalid')).toEqual([]);
    });
  });

  describe('sanitizeDappMetadata', () => {
    it('sanitizes untrusted metadata object', () => {
      const raw = {
        name: '<script>Evil</script> App',
        origin: 'https://evil.dapp.io',
        url: 'javascript:alert(1)',
        iconUrl: 'https://evil.dapp.io/icon.png',
        description: 'DApp with <img src=x onerror=alert(1)>',
      };

      const meta = sanitizeDappMetadata(raw);
      expect(meta.name).toContain('&lt;script&gt;Evil&lt;&#x2F;script&gt; App');
      expect(meta.origin).toBe('https://evil.dapp.io');
      expect(meta.url).toBe(''); // rejected javascript:
      expect(meta.iconUrl).toBe('https://evil.dapp.io/icon.png');
      expect(meta.description).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('returns default fallback when metadata is null or malformed', () => {
      const meta = sanitizeDappMetadata(null);
      expect(meta.name).toBe('Unknown dApp');
      expect(meta.origin).toBe('Unknown origin');
    });
  });
});
