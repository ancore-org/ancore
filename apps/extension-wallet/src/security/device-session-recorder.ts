/**
 * Device Session Recorder
 *
 * Populates the Device Sessions store, which is otherwise never written to.
 *
 * Every successful unlock (and the initial onboarding, which leaves the wallet
 * unlocked) records the browser profile the wallet was opened in. Because the
 * store persists to extension storage, a second browser profile that unlocks
 * the same synced vault shows up as an additional, non-current device and
 * raises the new-device alert in Security Settings.
 */

import { buildCurrentDeviceSession } from './device-identity';
import { useDeviceSessionsStore } from '../stores/deviceSessions';

/**
 * Upsert the current device into the store.
 *
 * Persisted state is rehydrated first: `addDevice` merges into whatever is in
 * memory, so recording before rehydration finishes would let the incoming
 * storage snapshot overwrite the record we just wrote.
 *
 * Never throws — device bookkeeping must not be able to fail an unlock.
 */
export async function recordCurrentDevice(): Promise<void> {
  try {
    if (!useDeviceSessionsStore.persist.hasHydrated()) {
      await useDeviceSessionsStore.persist.rehydrate();
    }

    const device = await buildCurrentDeviceSession();
    const { devices, addDevice } = useDeviceSessionsStore.getState();

    // Persisted records carry the `isCurrent` flag of whichever profile wrote
    // them. Clear any stale claim before recording, so a record synced from
    // another browser profile cannot masquerade as this device — which would
    // both mislabel it "(this device)" and make it unrevocable.
    for (const stale of devices) {
      if (stale.isCurrent && stale.id !== device.id) {
        addDevice({ ...stale, isCurrent: false });
      }
    }

    addDevice(device);
  } catch (error) {
    console.error('Failed to record device session', error);
  }
}
