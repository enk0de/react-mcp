export function serializeData(obj: any, depth = 0, maxDepth = 3): any {
  // Prevent infinite recursion
  if (depth > maxDepth) return "[Max Depth Reached]";

  if (obj === null || obj === undefined) return obj;

  // Primitives
  if (typeof obj !== "object" && typeof obj !== "function") return obj;

  // Functions
  if (typeof obj === "function") {
    return `[Function: ${obj.name || "anonymous"}]`;
  }

  // Arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => serializeData(item, depth + 1, maxDepth));
  }

  // DOM elements
  if (obj instanceof HTMLElement) {
    return `[HTMLElement: ${obj.tagName}]`;
  }

  // React elements
  if (obj.$$typeof) {
    return "[React Element]";
  }

  // Objects
  try {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeData(obj[key], depth + 1, maxDepth);
      }
    }
    return serialized;
  } catch (e) {
    return "[Unserializable Object]";
  }
}
