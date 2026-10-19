import type { SessionKey } from '@ancore/types';

function toHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function filterSessionKeys(keys: SessionKey[], query: string): SessionKey[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return keys;

  return keys.filter(
    (key) =>
      key.publicKey.toLowerCase().includes(needle) ||
      toHex(key.publicKey).includes(needle) ||
      (key.label?.toLowerCase().includes(needle) ?? false)
  );
}
