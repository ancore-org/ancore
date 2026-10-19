/* eslint-disable no-script-url */
/**
 * Sanitization utilities for untrusted dApp metadata.
 *
 * Incoming metadata from dApps (via postMessage, deep links, or RPC) must never
 * be trusted. These helpers neutralize HTML injection, script tags, event handlers,
 * and dangerous URI schemes (e.g. javascript:) before data is rendered in the UI.
 *
 * Issue #1506
 */

/**
 * Escapes common HTML entity characters to prevent HTML/XSS injection.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strips or neutralizes dangerous HTML tags, inline scripts, event handlers,
 * and executable pseudo-protocols from arbitrary text.
 *
 * Normal strings containing unicode characters, whitespace, and typical
 * punctuation are preserved cleanly.
 */
export function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  let text = typeof input === 'string' ? input : String(input);

  // Remove null bytes
  text = text.replace(/\0/g, '');

  // Strip script/iframe/style/object/embed tags and their contents
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

  // Strip inline event handlers: e.g. onerror=..., onload=..., onclick=...
  text = text.replace(/(\bon\w+\s*=\s*(['"]).*?\2)/gi, '');
  text = text.replace(/(\bon\w+\s*=\s*[^\s>]+)/gi, '');

  // Neutralize javascript: pseudo-protocols
  text = text.replace(/javascript\s*:/gi, '');
  text = text.replace(/vbscript\s*:/gi, '');
  text = text.replace(/data\s*:\s*text\/html/gi, '');

  // Strip any remaining raw HTML tag delimiters, converting them to plain text
  text = text.replace(/<[^>]*>?/gm, '');

  // Trim leading/trailing whitespace
  return text.trim();
}

/**
 * Validates and sanitizes URLs (such as dApp icons or origin URLs).
 * Only allows http:, https:, or safe data:image/ URIs.
 * Disallows javascript:, vbscript:, data:text/html, etc.
 */
export function sanitizeUrl(url: unknown): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();

  // Explicit check for dangerous pseudo-protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return '';
  }

  // Allow safe data URLs for images
  if (lower.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    // If relative path without scheme, only allow if not starting with javascript:
    if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
      return trimmed;
    }
    return '';
  }
}

export interface DappMetadata {
  name?: string;
  origin?: string;
  iconUrl?: string;
  description?: string;
}

/**
 * Sanitizes all fields of a dApp metadata object.
 */
export function sanitizeDappMetadata<T extends DappMetadata>(metadata: T): T {
  return {
    ...metadata,
    name: metadata.name ? sanitizeText(metadata.name) : metadata.name,
    origin: metadata.origin ? sanitizeText(metadata.origin) : metadata.origin,
    iconUrl: metadata.iconUrl ? sanitizeUrl(metadata.iconUrl) : metadata.iconUrl,
    description: metadata.description ? sanitizeText(metadata.description) : metadata.description,
  };
}
