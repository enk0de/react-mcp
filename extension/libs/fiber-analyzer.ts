import { nanoid } from "nanoid";
import type { FiberNode } from "../types/fiber-node";
import { RenderedComponentData } from "../types/messages";
import { getComponentName } from "../utils/get-component-name";

/**
 * Component registry interface for FiberAnalyzer
 */
export interface ComponentRegistry {
  /**
   * Get component info by DOM element
   */
  get(element: HTMLElement): RenderedComponentData | undefined;

  /**
   * Set component info for DOM element
   */
  set(element: HTMLElement, info: RenderedComponentData): void;

  /**
   * Delete component info by DOM element
   */
  delete(element: HTMLElement): void;

  /**
   * Check if component exists for DOM element
   */
  has(element: HTMLElement): boolean;
}

/**
 * React Fiber Flags (from ReactFiberFlags.js)
 */
export const FiberFlags = {
  Placement: 0b0000000000000010, // 2 - New node
  Update: 0b0000000000000100, // 4 - Props or state changed
  Deletion: 0b0000000000001000, // 8 - Node will be deleted
} as const;

/**
 * FiberAnalyzer - Analyzes React Fiber tree and manages component registry
 */
export class FiberAnalyzer {
  /**
   * Analyze fiber tree and update component registry
   */
  analyze(
    fiberRoot: { current: FiberNode } | null | undefined,
    componentRegistry: ComponentRegistry
  ): void {
    if (fiberRoot == null || fiberRoot.current == null) return;

    this.traverseFiber(fiberRoot.current, componentRegistry);
  }

  /**
   * Recursively remove deleted fiber and all descendants from registry
   */
  private removeDeletedFiber(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    if (!fiber) return;

    // Remove from registry if it has a DOM node
    if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
      componentRegistry.delete(fiber.stateNode);
    }

    // Recursively remove all children
    let child = fiber.child;
    while (child) {
      this.removeDeletedFiber(child, componentRegistry);
      child = child.sibling;
    }
  }

  /**
   * Traverse fiber tree and process each fiber node
   */
  private traverseFiber(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    if (!fiber) return;

    // Handle deletions first - process deleted children and all their descendants
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

    // Process current fiber's flags
    if (fiber.flags) {
      this.processFiberFlags(fiber, componentRegistry);
    }

    // Extract/update component info if not already handled by flags
    if (
      fiber.stateNode &&
      fiber.stateNode instanceof HTMLElement &&
      !componentRegistry.has(fiber.stateNode)
    ) {
      this.registerComponent(fiber, componentRegistry);
    }

    // Only traverse children if subtreeFlags indicates there are changes in subtree
    // or if this is the initial traversal (no flags set yet)
    if (fiber.subtreeFlags | 0) {
      let child = fiber.child;
      while (child) {
        this.traverseFiber(child, componentRegistry);
        child = child.sibling;
      }
    }
  }

  /**
   * Process fiber flags and update component registry accordingly
   */
  private processFiberFlags(
    fiber: FiberNode,
    componentRegistry: ComponentRegistry
  ): void {
    const { Placement, Update, Deletion } = FiberFlags;

    if (fiber.flags & Placement) {
      console.log(
        `[FiberAnalyzer] Component placed: ${getComponentName(fiber)}`
      );
      // Extract component info for new placement
      if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
        this.registerComponent(fiber, componentRegistry);
      }
    }

    if (fiber.flags & Update) {
      console.log(
        `[FiberAnalyzer] Component updated: ${getComponentName(fiber)}`
      );
      // Update component info
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
      // This fiber will be deleted, don't process further
      return;
    }
  }

  /**
   * Register a new component in the registry
   */
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

  /**
   * Update an existing component in the registry
   */
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
    props: fiber.memoizedProps || {},
    state: fiber.memoizedState || {},
  };
}
