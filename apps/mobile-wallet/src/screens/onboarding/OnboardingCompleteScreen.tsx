type Props = {
  onRestart?: () => void;
};

const noop = () => {};

export function OnboardingCompleteScreen({ onRestart = noop }: Props) {
  return (
    <section aria-label="Onboarding complete" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Complete</p>
        <h1 className="text-2xl font-semibold text-slate-950">Wallet setup complete</h1>
        <p className="text-sm text-slate-600">Restart returns the flow to the first screen.</p>
      </header>

      <button onClick={onRestart} type="button">
        Restart onboarding
      </button>
    </section>
  );
}
