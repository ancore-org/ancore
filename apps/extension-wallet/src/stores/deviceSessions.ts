/**
 * Device Sessions Store (Zustand)
 *
 * Tracks trusted devices and active sessions. Supports revoke, new-device
 * alerts, and persistence via extensionStorage.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DeviceSession {
  /** Stable device identifier (UUID or fingerprint). */
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  /** ISO timestamp of last known activity. */
  lastSeenAt: string;
  /** True when this record represents the session running right now. */
  isCurrent: boolean;
  trusted: boolean;
}

export interface DeviceSessionsState {
  devices: DeviceSession[];
  /** ID of a newly-added non-current device pending user acknowledgement. */
  alertDeviceId: string | null;

  /**
   * Upsert a device. If the device is new and not the current device, sets
   * `alertDeviceId` to surface a new-device alert banner.
   */
  addDevice: (device: DeviceSession) => void;

  /**
   * Remove a device by id.
   * - No-op when the id is not found.
   * - Silently ignores attempts to revoke the current device.
   */
  revokeDevice: (id: string) => void;

  /** Clear the new-device alert without removing the device. */
  dismissAlert: () => void;

  /** Reset all state (used on wallet reset). */
  reset: () => void;
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_STATE: Pick<DeviceSessionsState, 'devices' | 'alertDeviceId'> = {
  devices: [],
  alertDeviceId: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDeviceSessionsStore = create<DeviceSessionsState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      addDevice: (device) =>
        set((state) => {
          const exists = state.devices.some((d) => d.id === device.id);
          const isNewNonCurrent = !exists && !device.isCurrent;

          return {
            devices: exists
              ? state.devices.map((d) => (d.id === device.id ? { ...d, ...device } : d))
              : [...state.devices, device],
            alertDeviceId: isNewNonCurrent ? device.id : state.alertDeviceId,
          };
        }),

      revokeDevice: (id) =>
        set((state) => {
          const target = state.devices.find((d) => d.id === id);
          if (!target || target.isCurrent) {
            return state;
          }
          return {
            devices: state.devices.filter((d) => d.id !== id),
            alertDeviceId: state.alertDeviceId === id ? null : state.alertDeviceId,
          };
        }),

      dismissAlert: () => set({ alertDeviceId: null }),

      reset: () => set(INITIAL_STATE),
    }),
    {
      name: 'ancore-device-sessions',
      storage: createJSONStorage(() => extensionStorage),
      partialize: (state) => ({
        devices: state.devices,
      }),
    }
  )
);

export function getDeviceSessionsState() {
  return useDeviceSessionsStore.getState();
}
