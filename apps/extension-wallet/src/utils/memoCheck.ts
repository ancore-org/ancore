const cache = new Map<string, boolean>();

interface StellarExpertDirectoryEntry {
  require_memo?: boolean;
}

export async function isMemoRequired(destination: string): Promise<boolean> {
  if (cache.has(destination)) {
    return cache.get(destination)!;
  }

  try {
    const res = await fetch(`https://api.stellar.expert/explorer/public/directory/${destination}`);
    if (!res.ok) {
      cache.set(destination, false);
      return false;
    }
    const data: StellarExpertDirectoryEntry = await res.json();
    const required = data.require_memo === true;
    cache.set(destination, required);
    return required;
  } catch {
    cache.set(destination, false);
    return false;
  }
}
