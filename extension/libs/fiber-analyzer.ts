import type { RenderedComponentData } from "@react-mcp/core";
import { nanoid } from "nanoid";
import type { FiberNode } from "../types/fiber-node";
import { getComponentName } from "../utils/get-component-name";
import { serialize } from "../utils/serialize";

export interface ComponentRegistry {
  get(element: HTMLElement): RenderedComponentData | undefined;
  set(element: HTMLElement, info: RenderedComponentData): void;
  delete(element: HTMLElement): void;
  has(element: HTMLElement): boolean;
}

export const FiberFlags = {
  Placement: 0b0000000000000010,
  Update: 0b0000000000000100,
  Deletion: 0b0000000000001000,
} as const;

export class FiberAnalyzer {
  analyze(
    fiberRoot: { current: FiberNode } | null | undefined,
    componentRegistry: ComponentRegistry
  ): void {
    if (fiberRoot == null || fiberRoot.current == null) return;

    this.traverseFiber(fiberRoot.current, componentRegistry);
  }

  private removeDeletedFiber(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    if (!fiber) return;

    if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
      componentRegistry.delete(fiber.stateNode);
    }

    let child = fiber.child;
    while (child) {
      this.removeDeletedFiber(child, componentRegistry);
      child = child.sibling;
    }
  }

  private traverseFiber(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    if (!fiber) return;

    if (fiber.deletions && fiber.deletions.length > 0) {
      console.log(
        `[FiberAnalyzer] Processing ${
          fiber.deletions.length
        } deletions in ${getComponentName(fiber)}`
      );

      fiber.deletions.forEach((deletedFiber: FiberNode) => {
        this.removeDeletedFiber(deletedFiber, componentRegistry);
      });
    }

    if (fiber.flags) {
      this.processFiberFlags(fiber, componentRegistry);
    }

    if (
      fiber.stateNode &&
      fiber.stateNode instanceof HTMLElement &&
      !componentRegistry.has(fiber.stateNode)
    ) {
      this.registerComponent(fiber, componentRegistry);
    }

    if (fiber.subtreeFlags | 0) {
      let child = fiber.child;
      while (child) {
        this.traverseFiber(child, componentRegistry);
        child = child.sibling;
      }
    }
  }

  private processFiberFlags(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    const { Placement, Update, Deletion } = FiberFlags;

    if (fiber.flags & Placement) {
      console.log(
        `[FiberAnalyzer] Component placed: ${getComponentName(fiber)}`
      );
      if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
        this.registerComponent(fiber, componentRegistry);
      }
    }

    if (fiber.flags & Update) {
      console.log(
        `[FiberAnalyzer] Component updated: ${getComponentName(fiber)}`
      );
      if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
        this.updateComponent(fiber, componentRegistry);
      }
    }

    if (fiber.flags & Deletion) {
      console.log(
        `[FiberAnalyzer] Component marked for deletion: ${getComponentName(
          fiber
        )}`
      );
      return;
    }
  }

  private registerComponent(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    const data = transformFiber(fiber);

    if (data == null) {
      return;
    }

    componentRegistry.set(fiber.stateNode, data);
  }

  private updateComponent(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    const data = transformFiber(fiber);

    if (data == null) {
      return;
    }

    const existingInfo = componentRegistry.get(fiber.stateNode);

    if (existingInfo == null) {
      componentRegistry.set(fiber.stateNode, data);
      return;
    }

    componentRegistry.set(fiber.stateNode, {
      ...data,
      id: existingInfo.id,
    });
  }
}

function transformFiber(fiber: FiberNode): RenderedComponentData | null {
  if (!fiber) return null;

  if (!fiber.stateNode || !(fiber.stateNode instanceof HTMLElement)) {
    return null;
  }

  return {
    id: nanoid(),
    name: getComponentName(fiber),
    file: fiber._debugSource?.fileName || "unknown",
    props: serialize(fiber.memoizedProps) || {},
    state: serialize(fiber.memoizedState) || {},
  };
}
