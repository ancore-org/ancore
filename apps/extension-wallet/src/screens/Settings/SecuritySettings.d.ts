interface SecuritySettingsProps {
  autoLockTimeout: number;
  onAutoLockChange: (minutes: number) => void;
  onBack: () => void;
}
export declare function SecuritySettings({
  autoLockTimeout,
  onAutoLockChange,
  onBack,
}: SecuritySettingsProps): import('react/jsx-runtime').JSX.Element;
export {};
//# sourceMappingURL=SecuritySettings.d.ts.map
