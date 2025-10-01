/// <reference path="../.wxt/wxt.d.ts" />

import { nanoid } from "nanoid";
import { GuideOverlay } from "../libs/guide-overlay";
import { FiberNode } from "../types/fiber-node";
import type {
  ContentMessage,
  ReactErrorData,
  RenderedComponentData,
} from "../types/messages";

/**
 * Content script that injects into React applications
 * Detects React, analyzes component tree, and communicates with background script
 */

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  world: "MAIN", // Run in page context, not isolated world
  main() {
    const mcp = new ReactMCP();
    mcp.init();
  },
});

interface ComponentInfo {
  id: string;
  name: string;
  props: Record<string, any>;
  state: Record<string, any>;
  fiber: FiberNode;
  domNode: HTMLElement | null;
}

class ReactMCP {
  private componentMap = new Map<HTMLElement, ComponentInfo>();

  private selectedComponentInfo: RenderedComponentData | null = null;
  private selectedOverlay: HTMLElement | null = null;
  private selectedElement: HTMLElement | null = null;

  private errorOverlays = new Map<HTMLElement, HTMLElement>();

  private errors: ReactErrorData[] = [];
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private guideOverlay: GuideOverlay;

  constructor() {
    this.guideOverlay = new GuideOverlay();
  }

  init() {
    this.guideOverlay.create();
    this.setupReactDevToolsHook();
    this.setupClickListener();
    this.setupErrorBoundary();
    this.setupOverlayUpdateListeners();
    this.setupMessageListener();
  }

  private setupMessageListener() {
    // Listen for messages from bridge content script
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;

      const message = event.data;
      if (message?.source === "react-mcp-bridge") {
        if (message?.type === "REQUEST_STATE_FOR_HANDSHAKE") {
          console.log("[React MCP] State for handshake requested");
          this.sendStateForHandshake();
        }
      }
    });
  }

  private setupOverlayUpdateListeners() {
    // Use requestAnimationFrame for scroll events (throttled automatically)
    const updateOverlay = () => {
      if (this.selectedElement && this.selectedOverlay) {
        this.updateOverlayPosition();
      }
      this.rafId = null;
    };

    const scheduleUpdate = () => {
      if (this.rafId === null) {
        this.rafId = requestAnimationFrame(updateOverlay);
      }
    };

    // Listen for scroll events (passive for better performance)
    window.addEventListener("scroll", scheduleUpdate, {
      passive: true,
      capture: true,
    });

    // Use ResizeObserver for viewport resize
    this.resizeObserver = new ResizeObserver(scheduleUpdate);
    this.resizeObserver.observe(document.documentElement);
  }

  private setupReactDevToolsHook() {
    let wrappedHook: any = null;
    let originalHook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

    Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
      get() {
        return wrappedHook ?? originalHook;
      },
      set(value) {
        originalHook = value;
        wrappedHook = wrap(value);

        if (!this.isReactDetected) {
          notifyBackgroundScript({
            type: "REACT_DETECTED",
          });
          this.isReactDetected = true;
        }
      },
    });

    const wrap = (hook: any) => {
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
      hook.onCommitFiberRoot = (...args: any[]) => {
        try {
          if (originalOnCommitFiberRoot) {
            originalOnCommitFiberRoot.apply(hook, args);
          }

          this.analyzeFiberTree(args[1]);
        } catch (error) {
          console.error("[React MCP] Error analyzing fiber tree:", error);
        }
      };
    };
  }

  private setupClickListener() {
    document.addEventListener(
      "click",
      (e: MouseEvent) => {
        // Check if Alt/Option key is pressed
        if (!e.altKey) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const componentInfo = this.componentMap.get(target);

        if (componentInfo) {
          console.log("[React MCP] Component clicked:", componentInfo);

          const data: RenderedComponentData = {
            id: componentInfo.id,
            name: componentInfo.name,
            file: componentInfo.fiber._debugSource.fileName,
            props: serializeData(componentInfo.props),
            state: serializeData(componentInfo.state),
          };

          // Store selected component info
          this.selectedComponentInfo = data;

          notifyBackgroundScript({
            type: "COMPONENT_CLICKED",
            data,
          });
          this.highlightComponent(target);
        }
      },
      true
    );
  }

  private setupErrorBoundary() {
    // Keep console.error interceptor as fallback for uncaught errors
    const originalError = console.error;
    console.error = (...args: any[]) => {
      originalError.apply(console, args);

      const errorMessage = args.join(" ");
      if (
        errorMessage.includes("React") ||
        errorMessage.includes("component")
      ) {
        console.log("[React MCP] Console error detected:", errorMessage);

        const data: ReactErrorData = {
          message: errorMessage,
          source: "console",
        };

        // Store error
        this.errors.push(data);
        if (this.errors.length > 100) {
          this.errors = this.errors.slice(-100);
        }

        notifyBackgroundScript({
          type: "REACT_ERROR",
          data,
        });
      }
    };
  }

  private analyzeFiberTree(fiberRoot?: { current: FiberNode } | null) {
    if (fiberRoot == null || fiberRoot.current == null) return;

    // React Fiber Flags (from ReactFiberFlags.js)
    const Placement = 0b0000000000000010; // 2 - New node
    const Update = 0b0000000000000100; // 4 - Props or state changed
    const Deletion = 0b0000000000001000; // 8 - Node will be deleted

    // Helper function to recursively remove deleted fiber and all descendants
    const removeDeletedFiber = (fiber: FiberNode) => {
      if (!fiber) return;

      // Remove from maps if it has a DOM node
      if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
        this.componentMap.delete(fiber.stateNode);
        const overlay = this.errorOverlays.get(fiber.stateNode);
        if (overlay) {
          overlay.remove();
          this.errorOverlays.delete(fiber.stateNode);
        }
      }

      // Recursively remove all children
      let child = fiber.child;
      while (child) {
        removeDeletedFiber(child);
        child = child.sibling;
      }
    };

    const traverse = (fiber: FiberNode) => {
      if (!fiber) return;

      // Handle deletions first - process deleted children and all their descendants
      if (fiber.deletions && fiber.deletions.length > 0) {
        console.log(
          `[React MCP] Processing ${
            fiber.deletions.length
          } deletions in ${getComponentName(fiber)}`
        );

        fiber.deletions.forEach((deletedFiber: FiberNode) => {
          removeDeletedFiber(deletedFiber);
        });
      }

      // Process current fiber's flags
      if (fiber.flags) {
        if (fiber.flags & Placement) {
          console.log(
            `[React MCP] Component placed: ${getComponentName(fiber)}`
          );
          // Extract component info for new placement
          if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
            const componentInfo: ComponentInfo = {
              id: nanoid(),
              name: getComponentName(fiber),
              props: fiber.memoizedProps || {},
              state: fiber.memoizedState || {},
              fiber: fiber,
              domNode: fiber.stateNode,
            };
            this.componentMap.set(fiber.stateNode, componentInfo);
          }
        }

        if (fiber.flags & Update) {
          console.log(
            `[React MCP] Component updated: ${getComponentName(fiber)}`
          );
          // Update component info
          if (fiber.stateNode && fiber.stateNode instanceof HTMLElement) {
            const existingInfo =
              fiber.stateNode != null
                ? this.componentMap.get(fiber.stateNode as HTMLElement)
                : null;

            const componentInfo: ComponentInfo = {
              id: existingInfo?.id || nanoid(),
              name: getComponentName(fiber),
              props: fiber.memoizedProps || {},
              state: fiber.memoizedState || {},
              fiber: fiber,
              domNode: fiber.stateNode,
            };
            this.componentMap.set(fiber.stateNode, componentInfo);
          }
        }

        if (fiber.flags & Deletion) {
          console.log(
            `[React MCP] Component marked for deletion: ${getComponentName(
              fiber
            )}`
          );
          // This fiber will be deleted, don't process further
          return;
        }
      }

      // Extract/update component info if not already handled by flags
      if (
        fiber.stateNode &&
        fiber.stateNode instanceof HTMLElement &&
        !this.componentMap.has(fiber.stateNode)
      ) {
        const componentInfo: ComponentInfo = {
          id: nanoid(),
          name: getComponentName(fiber),
          props: fiber.memoizedProps || {},
          state: fiber.memoizedState || {},
          fiber: fiber,
          domNode: fiber.stateNode,
        };
        this.componentMap.set(fiber.stateNode, componentInfo);
      }

      // Only traverse children if subtreeFlags indicates there are changes in subtree
      // or if this is the initial traversal (no flags set yet)
      if (fiber.subtreeFlags | 0) {
        let child = fiber.child;
        while (child) {
          traverse(child);
          child = child.sibling;
        }
      }
    };

    traverse(fiberRoot.current);
  }

  private highlightComponent(domNode: HTMLElement) {
    // Store reference to selected element
    this.selectedElement = domNode;

    // Create overlay if it doesn't exist
    if (this.selectedOverlay == null) {
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.backgroundColor = "rgba(255, 165, 0, 0.3)"; // Semi-transparent orange
      overlay.style.border = "2px solid orange";
      overlay.style.zIndex = "9999";
      overlay.style.pointerEvents = "none"; // Allow clicks to pass through
      overlay.style.transition = "none"; // Disable transitions for smooth updates

      document.body.appendChild(overlay);
      this.selectedOverlay = overlay;
    }

    // Update position
    this.updateOverlayPosition();
  }

  private updateOverlayPosition() {
    if (!this.selectedElement || !this.selectedOverlay) return;

    const rect = this.selectedElement.getBoundingClientRect();

    // Update overlay position and size
    this.selectedOverlay.style.top = `${rect.top}px`;
    this.selectedOverlay.style.left = `${rect.left}px`;
    this.selectedOverlay.style.width = `${rect.width}px`;
    this.selectedOverlay.style.height = `${rect.height}px`;
  }

  private sendStateForHandshake() {
    // Collect all component data
    console.log("[React MCP] Preparing state for handshake...");
    const components: RenderedComponentData[] = [];
    this.componentMap.forEach((info) => {
      if (info.fiber._debugSource) {
        components.push({
          id: info.id,
          name: info.name,
          file: info.fiber._debugSource.fileName,
          props: serializeData(info.props),
          state: serializeData(info.state),
        });
      }
    });

    console.log("[React MCP] Sending state for handshake:", {
      componentsCount: components.length,
      errorsCount: this.errors.length,
      hasSelectedComponent: this.selectedComponentInfo != null,
    });

    notifyBackgroundScript({
      type: "STATE_FOR_HANDSHAKE",
      data: {
        components,
        errors: this.errors,
        selectedComponent: this.selectedComponentInfo,
      },
    });
  }
}

function notifyBackgroundScript(message: ContentMessage) {
  // Since we're in MAIN world, we can't use chrome API directly
  // Send message via window.postMessage to ISOLATED world content script
  window.postMessage(
    {
      source: "react-mcp-main",
      type: message.type,
      data: message.data,
    },
    "*"
  );
}
