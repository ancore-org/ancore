/* eslint-disable no-script-url */
import { describe, it, expect } from 'vitest';
import { sanitizeText, escapeHtml, sanitizeUrl, sanitizeDappMetadata } from '../sanitize';

describe('sanitizeText', () => {
  it('strips <script> tags and enclosed code', () => {
    const dirty = 'Awesome dApp <script>alert("xss")</script>';
    expect(sanitizeText(dirty)).toBe('Awesome dApp');
  });

  it('neutralizes inline event handlers like onerror and onload', () => {
    const dirty = '<img src=x onerror=alert(1)>Malicious Exchange';
    const sanitized = sanitizeText(dirty);
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('alert(1)');
    expect(sanitized).toContain('Malicious Exchange');
  });

  it('strips javascript: pseudo-protocols', () => {
    const dirty = 'javascript:alert(document.cookie)';
    expect(sanitizeText(dirty)).not.toContain('javascript:');
  });

  it('strips iframe and embedded HTML markup', () => {
    const dirty = '<h1>Stellar Portal</h1><iframe src="evil.com"></iframe>';
    expect(sanitizeText(dirty)).toBe('Stellar Portal');
  });

  it('preserves clean names with UTF-8 characters and standard punctuation', () => {
    const clean = 'Soroban DEX (v2.0) — Échange décentralisé & sécurisé!';
    expect(sanitizeText(clean)).toBe('Soroban DEX (v2.0) — Échange décentralisé & sécurisé!');
  });

  it('handles null, undefined, and non-string inputs safely', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(12345)).toBe('12345');
  });
});

describe('escapeHtml', () => {
  it('escapes &, <, >, ", and single quotes', () => {
    const raw = '<div class="test" data-id=\'1\'>A & B</div>';
    const escaped = escapeHtml(raw);
    expect(escaped).toBe(
      '&lt;div class=&quot;test&quot; data-id=&#x27;1&#x27;&gt;A &amp; B&lt;/div&gt;'
    );
  });
});

describe('sanitizeUrl', () => {
  it('allows safe https and http URLs', () => {
    expect(sanitizeUrl('https://example.com/logo.png')).toBe('https://example.com/logo.png');
    expect(sanitizeUrl('http://localhost:3000')).toBe('http://localhost:3000/');
  });

  it('allows safe data:image/ URIs', () => {
    const dataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    expect(sanitizeUrl(dataUri)).toBe(dataUri);
  });

  it('blocks javascript: URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('JAVASCRIPT:alert("pwned")')).toBe('');
  });

  it('blocks data:text/html URIs', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('handles null, undefined, or empty inputs gracefully', () => {
    expect(sanitizeUrl('')).toBe('');
    expect(sanitizeUrl(null)).toBe('');
    expect(sanitizeUrl(undefined)).toBe('');
  });
});

describe('sanitizeDappMetadata', () => {
  it('sanitizes all fields of dApp metadata', () => {
    const dirtyMetadata = {
      name: 'Dex<script>pwn()</script>',
      origin: 'https://dex.stellar.org<img src=x onerror=alert(1)>',
      iconUrl: 'javascript:alert(1)',
      description: 'Trade tokens <b>securely</b>',
    };

    const sanitized = sanitizeDappMetadata(dirtyMetadata);
    expect(sanitized.name).toBe('Dex');
    expect(sanitized.origin).toBe('https://dex.stellar.org');
    expect(sanitized.iconUrl).toBe('');
    expect(sanitized.description).toBe('Trade tokens securely');
  });
});
