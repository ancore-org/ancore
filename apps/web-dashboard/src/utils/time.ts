export function formatRelativeExpiry(expiresAtSeconds: number, nowMs = Date.now()): string {
  const remainingSeconds = expiresAtSeconds - nowMs / 1000;
  if (remainingSeconds <= 0) return 'expired';

  const units = [
    { seconds: 86_400, label: 'day' },
    { seconds: 3_600, label: 'hour' },
    { seconds: 60, label: 'minute' },
    { seconds: 1, label: 'second' },
  ] as const;

  const unit = units.find(({ seconds }) => remainingSeconds >= seconds) ?? units.at(-1)!;
  const count = Math.ceil(remainingSeconds / unit.seconds);
  return `in ${count} ${unit.label}${count === 1 ? '' : 's'}`;
}
