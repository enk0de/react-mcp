/**
 * Serializes data for transmission, handling circular references and non-serializable values
 */
export function serialize(data: unknown): unknown {
  const seen = new WeakSet();

  function serialize(data: unknown): any {
    if (data == null) return data;
    if (typeof data === 'symbol') return data.toString();
    if (typeof data === 'function') return '[Function]';
    if (typeof data !== 'object') return data;

    // Handle circular references
    if (seen.has(data)) return '[Circular]';
    seen.add(data);

    if (Array.isArray(data)) {
      return data.map(serialize);
    }

    if (data instanceof Date) return data.toISOString();
    if (data instanceof RegExp) return data.toString();
    if (data instanceof Error)
      return { message: data.message, stack: data.stack };

    // Handle plain objects
    const result: Record<string, any> = {};
    for (const _key in data) {
      const key = _key as keyof typeof data;

      if (Object.prototype.hasOwnProperty.call(data, key)) {
        try {
          result[key] = serialize(data[key]);
        } catch {
          result[key] = '[Unserializable]';
        }
      }
    }
    return result;
  }

  return serialize(data);
}
