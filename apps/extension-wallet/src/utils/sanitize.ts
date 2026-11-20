/* eslint-disable no-script-url, no-control-regex */
/**
 * Sanitization utilities for extension-wallet approval UI and untrusted dApp metadata.
 *
 * Incoming metadata from dApps (via postMessage, deep links, or RPC) must never
 * be trusted. These helpers neutralize HTML injection, script tags, event handlers,
 * control characters, and dangerous URI schemes (e.g. javascript:) before data is
 * rendered in the UI.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
};

const HTML_ENTITY_REGEX = /[&<>"'`/]/g;

/**
 * Escapes HTML characters in untrusted strings to prevent DOM XSS.
 */
export function escapeHtml(str: string): string {
  return str.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * Strips ASCII control characters except newline and tab.
 */
export function stripControlCharacters(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitizes an untrusted string by stripping control characters, escaping HTML,
 * and truncating to a maximum length.
 */
export function sanitizeString(value: unknown, maxLength = 256): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'string' ? value : String(value);
  const cleaned = stripControlCharacters(str.trim());
  const truncated = cleaned.slice(0, maxLength);
  return escapeHtml(truncated);
}

/**
 * Strips or neutralizes dangerous HTML tags, inline scripts, event handlers,
 * and executable pseudo-protocols from arbitrary text for plain-text React rendering.
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

  return text.trim();
}

const SAFE_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Validates and sanitizes URLs (such as dApp icons or origin URLs).
 * Only allows http:, https:, or safe data:image/ URIs.
 * Disallows javascript:, vbscript:, file:, data:text/html, etc.
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string' || !url.trim()) {
    return '';
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:') ||
    lower.startsWith('data:text/html')
  ) {
    return '';
  }

  // Allow safe data URLs for images
  if (lower.startsWith('data:image/')) {
    return trimmed;
  }

  if (lower.startsWith('data:')) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
      return '';
    }
    return parsed.href;
  } catch {
    if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
      return trimmed;
    }
    return '';
  }
}

/**
 * Validates and sanitizes a claimed origin.
 */
export function sanitizeOrigin(origin: unknown): string {
  if (typeof origin !== 'string' || !origin.trim()) {
    return 'Unknown origin';
  }

  const sanitized = sanitizeUrl(origin.trim());
  if (!sanitized) {
    return 'Untrusted origin';
  }

  try {
    const parsed = new URL(sanitized);
    return parsed.origin;
  } catch {
    return 'Untrusted origin';
  }
}

/**
 * Validates a Stellar contract address (SEP-43 / Soroban C...).
 */
const STELLAR_CONTRACT_REGEX = /^C[A-Z0-9]{55}$/;

export function sanitizeContractId(contractId: unknown): string {
  if (typeof contractId !== 'string') {
    return 'Unknown Contract';
  }
  const trimmed = contractId.trim();
  if (STELLAR_CONTRACT_REGEX.test(trimmed)) {
    return trimmed;
  }
  return 'Invalid Contract Address';
}

/**
 * Validates and sanitizes a contract method name.
 */
const METHOD_NAME_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

export function sanitizeMethodName(methodName: unknown): string {
  if (typeof methodName !== 'string') {
    return 'unknown_method';
  }
  const trimmed = methodName.trim();
  if (METHOD_NAME_REGEX.test(trimmed)) {
    return trimmed;
  }
  return sanitizeString(trimmed, 64);
}

/**
 * Sanitizes an array of requested permissions/scopes.
 */
export function sanitizePermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) {
    return [];
  }
  return permissions
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => sanitizeString(item, 64))
    .slice(0, 50);
}

export interface DappMetadata {
  name?: string;
  origin?: string;
  url?: string;
  iconUrl?: string;
  description?: string;
}

export interface SanitizedDAppMetadata {
  name: string;
  url: string;
  iconUrl: string;
  description: string;
  origin: string;
}

/**
 * Sanitizes untrusted dApp metadata object before rendering.
 */
export function sanitizeDappMetadata(raw: unknown): SanitizedDAppMetadata {
  if (!raw || typeof raw !== 'object') {
    return {
      name: 'Unknown dApp',
      url: '',
      iconUrl: '',
      description: '',
      origin: 'Unknown origin',
    };
  }

  const obj = raw as Record<string, unknown>;

  const name = sanitizeString(obj.name || obj.title || 'Unknown dApp', 100);
  const url = sanitizeUrl(obj.url || obj.origin);
  const iconUrl = sanitizeUrl(obj.iconUrl || obj.icon);
  const description = sanitizeString(obj.description || '', 500);
  const origin = sanitizeOrigin(obj.origin || obj.url);

  return {
    name: name || 'Unknown dApp',
    url,
    iconUrl,
    description,
    origin,
  };
}
