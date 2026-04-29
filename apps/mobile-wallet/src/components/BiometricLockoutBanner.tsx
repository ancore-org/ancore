type Props = {
  isPermanent: boolean;
  secondsRemaining: number;
  message: string | null;
};

export const BiometricLockoutBanner = ({
  isPermanent,
  secondsRemaining,
  message,
}: Props) => {
  const title = isPermanent
    ? 'Biometric authentication disabled'
    : `Temporarily locked — ${secondsRemaining}s remaining`;

  const body = isPermanent
    ? 'Your device has permanently disabled biometric access. Use your password below, or re-enroll biometrics in your device settings.'
    : (message ?? 'Too many failed attempts. Wait for the timer or use your password to unlock.');

  return (
    <div role="alert" aria-live="polite" aria-label={`${title}. ${body}`}>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
};