type Props = {
  onCreate?: () => void;
  onImport?: () => void;
  onRecover?: () => void;
};

const noop = () => {};

export function OnboardingEntryScreen({
  onCreate = noop,
  onImport = noop,
  onRecover = noop,
}: Props) {
  return (
    <section aria-label="Onboarding entry" className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Onboarding</p>
        <h1 className="text-2xl font-semibold text-slate-950">Set up your wallet</h1>
        <p className="text-sm text-slate-600">
          Choose a setup path to continue into the onboarding flow.
        </p>
      </header>

      <div className="space-y-3">
        <button onClick={onCreate} type="button">
          Create a new wallet
        </button>
        <button onClick={onImport} type="button">
          Import an existing wallet
        </button>
        <button onClick={onRecover} type="button">
          Recover from backup
        </button>
      </div>
    </section>
  );
}
