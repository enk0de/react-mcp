/**
 * Serializes data for transmission, handling circular references and non-serializable values
 */
export function serializeData(data: any): any {
  const seen = new WeakSet();

  function serialize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;

    // Handle circular references
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(serialize);
    }

    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof RegExp) return obj.toString();
    if (obj instanceof Error) return { message: obj.message, stack: obj.stack };

    // Handle functions
    if (typeof obj === "function") return "[Function]";

    // Handle plain objects
    const result: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        try {
          result[key] = serialize(obj[key]);
        } catch {
          result[key] = "[Unserializable]";
        }
      }
    }
    return result;
  }

  return serialize(data);
}
