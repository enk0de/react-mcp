import { useCallback, useSyncExternalStore } from "react";
import { PortStorage } from "../libs/storage/port";

const portStorage = new PortStorage();

function createPortStore() {
  let currentValue: number | null = null;

  // Initialize value
  portStorage.get().then((value) => {
    currentValue = value;
  });

  return {
    subscribe(listener: () => void) {
      return portStorage.watch((_, newValue) => {
        currentValue = newValue;
        listener();
      });
    },
    getSnapshot() {
      return currentValue;
    },
    async updatePort(newPort: number) {
      await portStorage.set(newPort);
    },
    async resetPort() {
      await portStorage.remove();
    },
  };
}

const portStore = createPortStore();

export function usePortStorage() {
  const port = useSyncExternalStore(
    portStore.subscribe,
    portStore.getSnapshot,
    portStore.getSnapshot
  );

  const updatePort = useCallback(async (newPort: number) => {
    await portStore.updatePort(newPort);
  }, []);

  const resetPort = useCallback(async () => {
    await portStore.resetPort();
  }, []);

  return {
    port,
    updatePort,
    resetPort,
  };
}
