export function SettingsScreen(): JSX.Element {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
      <h2 className="text-lg font-semibold">Settings</h2>
      <p className="mt-2 text-sm text-slate-600">
        Configure wallet preferences and security options.
      </p>
    </div>
  );
}

export default SettingsScreen;
