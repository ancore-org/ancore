/** Minimal browser stub for Node `util` when HD-key deps import it. */
export function debuglog() {
  return () => undefined;
}
export function inspect(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
export default { debuglog, inspect };
