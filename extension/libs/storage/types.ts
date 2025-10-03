export interface Storage<T> {
  get(): Promise<T | null>;
  set(value: T): Promise<void>;
  remove(): Promise<void>;
  watch(callback: (oldValue: T | null, newValue: T | null) => void): () => void;
}
