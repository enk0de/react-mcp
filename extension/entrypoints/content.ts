/// <reference path="../.wxt/wxt.d.ts" />

import type { ContentMessage, RenderedComponentData } from "@react-mcp/core";
import { FiberAnalyzer } from "../libs/fiber-analyzer";
import { ComponentInspectorPlugin } from "../plugins/component-inspector-plugin";
import { GuideOverlayPlugin } from "../plugins/guide-overlay-plugin";
import type { Plugin, PluginContext } from "../types/plugin";

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

class ReactMCP implements PluginContext {
  private componentMap = new Map<HTMLElement, RenderedComponentData>();
  private selectedComponentInfo: RenderedComponentData | null = null;
  private isReactDetected = false;

  private plugins: Plugin[] = [];
  private fiberAnalyzer: FiberAnalyzer;

  constructor() {
    this.fiberAnalyzer = new FiberAnalyzer();

    this.plugins = [
      new ComponentInspectorPlugin(this),
      new GuideOverlayPlugin(this),
    ];
  }

  init() {
    this.plugins.forEach((plugin) => {
      console.log(`[React MCP] Initializing plugin: ${plugin.name}`);
      plugin.init();
    });

    this.setupReactDevToolsHook();
    this.setupMessageListener();
  }

  // PluginContext implementation
  getComponent(element: HTMLElement): RenderedComponentData | undefined {
    return this.componentMap.get(element);
  }

  getAllComponents(): Map<HTMLElement, RenderedComponentData> {
    return this.componentMap;
  }

  registerComponent(element: HTMLElement, info: RenderedComponentData): void {
    this.componentMap.set(element, info);
  }

  unregisterComponent(element: HTMLElement): void {
    this.componentMap.delete(element);
  }

  sendMessage(message: ContentMessage): void {
    notifyBackgroundScript(message);
  }

  getSelectedComponent(): RenderedComponentData | null {
    return this.selectedComponentInfo;
  }

  setSelectedComponent(component: RenderedComponentData | null): void {
    this.selectedComponentInfo = component;
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

  private setupReactDevToolsHook() {
    let wrappedHook: any = null;
    let originalHook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

    Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
      get: () => {
        return wrappedHook ?? originalHook;
      },
      set: (value) => {
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

          // Analyze fiber tree with componentMap as registry
          this.fiberAnalyzer.analyze(args[1], this.componentMap);
        } catch (error) {
          console.error("[React MCP] Error analyzing fiber tree:", error);
        }
      };
    };
  }

  private sendStateForHandshake() {
    // Collect all component data
    console.log("[React MCP] Preparing state for handshake...");
    const components = this.getAllComponents();

    console.log("[React MCP] Sending state for handshake:", {
      componentsCount: components.size,
      hasSelectedComponent: this.selectedComponentInfo != null,
    });

    notifyBackgroundScript({
      type: "STATE_FOR_HANDSHAKE",
      data: {
        components: Array.from(components.values()),
        selectedComponent: this.selectedComponentInfo,
      },
    });
  }

  destroy() {
    this.plugins.forEach((plugin) => {
      if (plugin.destroy) {
        console.log(`[React MCP] Destroying plugin: ${plugin.name}`);
        plugin.destroy();
      }
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
