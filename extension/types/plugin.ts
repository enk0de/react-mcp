import { ContentMessage, RenderedComponentData } from "@react-mcp/core";
import type { FiberNode } from "./fiber-node";

/**
 * Plugin context provides access to ReactMCP state and methods
 */
export interface PluginContext {
  /**
   * Get component info by DOM element
   */
  getComponent(element: HTMLElement): RenderedComponentData | undefined;

  /**
   * Get all registered components
   */
  getAllComponents(): Map<HTMLElement, RenderedComponentData>;

  /**
   * Register a component
   */
  registerComponent(element: HTMLElement, info: RenderedComponentData): void;

  /**
   * Unregister a component
   */
  unregisterComponent(element: HTMLElement): void;

  /**
   * Send message to background script
   */
  sendMessage(message: ContentMessage): void;

  /**
   * Get selected component
   */
  getSelectedComponent(): RenderedComponentData | null;

  /**
   * Set selected component
   */
  setSelectedComponent(component: RenderedComponentData | null): void;
}

/**
 * Component information stored in the component map
 */
export interface ComponentInfo {
  id: string;
  name: string;
  props: Record<string, any>;
  state: Record<string, any>;
  fiber: FiberNode;
  domNode: HTMLElement | null;
}

/**
 * Base plugin interface
 */
export interface Plugin {
  /**
   * Plugin name for identification
   */
  readonly name: string;

  /**
   * Initialize the plugin
   */
  init(): void;

  /**
   * Cleanup when plugin is destroyed
   */
  destroy?(): void;
}

/**
 * Lifecycle hooks for plugins
 */
export interface PluginLifecycleHooks {
  /**
   * Called when React is detected
   */
  onReactDetected?(): void;

  /**
   * Called after fiber tree analysis
   */
  onFiberTreeAnalyzed?(fiberRoot: { current: FiberNode }): void;

  /**
   * Called when a component is updated
   */
  onComponentUpdate?(element: HTMLElement, info: ComponentInfo): void;

  /**
   * Called when a component is removed
   */
  onComponentRemove?(element: HTMLElement): void;
}
