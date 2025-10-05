/// <reference path="../.wxt/wxt.d.ts" />

import {
  safeParseBackgroundMessage,
  type ContentMessage,
  type RenderedComponentData,
} from '@react-mcp/core';
import { FiberAnalyzer } from '../libs/fiber-analyzer';
import { OverlayManager } from '../libs/overlay-manager';
import { ComponentInspectorPlugin } from '../plugins/component-inspector-plugin';
import type { Plugin, PluginContext } from '../types/plugin';

/**
 * Content script that injects into React applications
 * Detects React, analyzes component tree, and communicates with background script
 */

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  world: 'MAIN', // Run in page context, not isolated world
  main() {
    const mcp = new ReactMCP();
    mcp.init();
  },
});

class ReactMCP implements PluginContext {
  private componentMap = new Map<HTMLElement, RenderedComponentData>();
  private selectedComponentInfo: RenderedComponentData | null = null;

  private plugins: Plugin[] = [];
  private fiberAnalyzer: FiberAnalyzer;
  private overlayManager: OverlayManager;

  constructor() {
    this.fiberAnalyzer = new FiberAnalyzer();
    this.overlayManager = new OverlayManager(this);

    this.plugins = [new ComponentInspectorPlugin(this)];
  }

  init() {
    this.plugins.forEach((plugin) => {
      console.log(`[React MCP] Initializing plugin: ${plugin.name}`);
      plugin.init();
    });

    this.overlayManager.init();

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
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;

      const message = event.data;

      if (message?.source === 'react-mcp-bridge') {
        const parsed = safeParseBackgroundMessage(message.data);

        if (!parsed.success) {
          console.error('[React MCP] Error parsing message:', parsed.error);
          return;
        }
        console.log(parsed);

        if (parsed.data.type === 'REQUEST_STATE') {
          this.sendStateToServer();
        }
      }
    });
  }

  private setupReactDevToolsHook() {
    let originalHook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

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
          console.error('[React MCP] Error analyzing fiber tree:', error);
        }
      };
    };

    if (originalHook == null) {
      let wrappedHook: any = null;

      Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
        get: () => {
          return wrappedHook ?? originalHook;
        },
        set: (value) => {
          originalHook = value;
          wrappedHook = wrap(value);
        },
      });
    } else {
      let originalOnCommitFiberRoot = originalHook.onCommitFiberRoot;

      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot = (
        ...args: any[]
      ) => {
        originalOnCommitFiberRoot.apply(originalHook, args);

        // Analyze fiber tree with componentMap as registry
        this.fiberAnalyzer.analyze(args[1], this.componentMap);
      };
    }
  }

  private sendStateToServer() {
    console.log('[React MCP] Preparing state for server...');
    const components = this.getAllComponents();

    notifyBackgroundScript({
      type: 'SET_STATE',
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
      source: 'react-mcp-main',
      type: message.type,
      data: message.data,
    },
    '*',
  );
}
