import { FiberNode } from "../types/fiber-node";

export function getComponentName(fiber: FiberNode): string {
  if (fiber.type) {
    if (typeof fiber.type === "function") {
      return fiber.type.name || fiber.type.displayName || "Unknown";
    }
    if (typeof fiber.type === "string") {
      return fiber.type;
    }
  }
  return "Unknown";
}
