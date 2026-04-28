type Props = {
  attemptsRemaining: number;
  maxAttempts: number;
  message: string | null;
};

export const AttemptsIndicator = ({
  attemptsRemaining,
  maxAttempts,
  message,
}: Props) => {
  return (
    <section aria-label={`${attemptsRemaining} of ${maxAttempts} attempts remaining`}>
      <ul aria-hidden="true">
        {Array.from({ length: maxAttempts }).map((_, i) => (
          <li key={i} data-used={i >= attemptsRemaining} />
        ))}
      </ul>
      {message && (
        <p aria-live="polite">{message}</p>
      )}
    </section>
  );
};