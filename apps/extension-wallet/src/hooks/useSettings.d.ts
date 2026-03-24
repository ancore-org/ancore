import type { Network } from '@ancore/types';
export interface Settings {
  network: Network;
  autoLockTimeout: number;
}
export declare function useSettings(): {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};
//# sourceMappingURL=useSettings.d.ts.map
