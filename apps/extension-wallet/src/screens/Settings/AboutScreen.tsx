export function AboutScreen(): JSX.Element {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
      <h2 className="text-lg font-semibold">About Ancore</h2>
      <p className="mt-2 text-sm text-slate-600">
        Ancore extension wallet for Stellar account abstraction.
      </p>
    </div>
  );
}

export default AboutScreen;
