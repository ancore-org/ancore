import AsyncStorage from "@react-native-async-storage/async-storage";
import { StateStorage, createJSONStorage, persist } from "zustand/middleware";
import { useStore } from "./store";

const storage: StateStorage = createJSONStorage(() => AsyncStorage);

export const usePersistedStore = persist(useStore, {
  name: "wallet-store",
  storage,
  version: 1,

  migrate: (persistedState: any, version: number) => {
    if (version === 0) {
      return {
        ...persistedState,
        network: "testnet",
      };
    }
    return persistedState;
  },
});
