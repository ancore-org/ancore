import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { extensionStorage } from './_storage';
import type { SessionKey } from '@ancore/types';

interface SessionKeyState {
  keys: SessionKey[];
  addKey: (key: SessionKey) => void;
  removeKey: (publicKey: string) => void;
  updateKey: (publicKey: string, updates: Partial<SessionKey>) => void;
  setKeys: (keys: SessionKey[]) => void;
}

export const useSessionKeyStore = create<SessionKeyState>()(
  persist(
    (set) => ({
      keys: [],

      addKey: (key) =>
        set((state) => ({ keys: [...state.keys, key] })),

      removeKey: (publicKey) =>
        set((state) => ({ keys: state.keys.filter((k) => k.publicKey !== publicKey) })),

      updateKey: (publicKey, updates) =>
        set((state) => ({
          keys: state.keys.map((k) => (k.publicKey === publicKey ? { ...k, ...updates } : k)),
        })),

      setKeys: (keys) => set({ keys }),
    }),
    {
      name: 'ancore-session-keys',
      storage: createJSONStorage(() => extensionStorage),
    },
  ),
);
