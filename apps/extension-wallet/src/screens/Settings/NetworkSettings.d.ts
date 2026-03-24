import type { Network } from '@ancore/types';
interface NetworkSettingsProps {
  value: Network;
  onChange: (network: Network) => void;
  onBack: () => void;
}
export declare function NetworkSettings({
  value,
  onChange,
  onBack,
}: NetworkSettingsProps): import('react/jsx-runtime').JSX.Element;
export declare function ScreenHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}): import('react/jsx-runtime').JSX.Element;
export {};
//# sourceMappingURL=NetworkSettings.d.ts.map
