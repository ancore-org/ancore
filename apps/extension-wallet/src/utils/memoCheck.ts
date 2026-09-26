const cache = new Map<string, boolean>();

interface StellarExpertDirectoryEntry {
  require_memo?: boolean;
}

/**
 * Returns whether `destination` is listed as memo-required on stellar.expert.
 *
 * Only definitive 2xx directory results are cached. Network errors, timeouts,
 * and non-2xx responses fail open for this call (return false) but are not
 * stored, so a later check can still warn if the API recovers.
 */
export async function isMemoRequired(destination: string): Promise<boolean> {
  if (cache.has(destination)) {
    return cache.get(destination)!;
  }

  try {
    const res = await fetch(`https://api.stellar.expert/explorer/public/directory/${destination}`);
    if (!res.ok) {
      return false;
    }
    const data: StellarExpertDirectoryEntry = await res.json();
    const required = data.require_memo === true;
    cache.set(destination, required);
    return required;
  } catch {
    return false;
  }
}
