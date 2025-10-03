import { DEFAULT_PORT } from "@react-mcp/core";
import { Storage } from "./types";

export class PortStorage implements Storage<number> {
  private storage: WxtStorageItem<number, {}>;

  constructor() {
    this.storage = storage.defineItem<number>("local:port", {
      fallback: DEFAULT_PORT,
    });
  }

  async set(port: number): Promise<void> {
    await this.storage.setValue(port);
  }

  async get(): Promise<number> {
    return await this.storage.getValue();
  }

  async remove(): Promise<void> {
    await this.storage.removeValue();
  }

  watch(
    callback: (oldPort: number | null, newPort: number | null) => void
  ): () => void {
    return this.storage.watch((oldValue, newValue) => {
      callback(oldValue, newValue);
    });
  }
}
