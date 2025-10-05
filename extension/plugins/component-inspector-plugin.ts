import type { Plugin, PluginContext } from '../types/plugin';

/**
 * Plugin that enables component inspection via Alt+Click
 * Shows component overlay and sends component data to background script
 */
export class ComponentInspectorPlugin implements Plugin {
  readonly name = 'ComponentInspectorPlugin';

  private context: PluginContext;
  private selectedElement: HTMLElement | null = null;
  private selectedOverlay: HTMLElement | null = null;
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(context: PluginContext) {
    this.context = context;
  }

  init(): void {
    this.setupClickListener();
    this.setupOverlayUpdateListeners();
  }

  destroy(): void {
    // Remove overlay
    if (this.selectedOverlay) {
      this.selectedOverlay.remove();
      this.selectedOverlay = null;
    }

    // Cancel animation frame
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Disconnect resize observer
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.selectedElement = null;
  }

  private setupClickListener(): void {
    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        // Check if Alt/Option key is pressed
        if (!e.altKey) return;

        e.preventDefault();
        e.stopPropagation();

        const target = e.target as HTMLElement;
        const component = this.context.getComponent(target);

        if (component != null) {
          console.log('[React MCP] Component clicked:', component);

          // Store selected component info
          this.context.setSelectedComponent(component);

          this.context.sendMessage({
            type: 'SELECT_COMPONENT',
            data: component,
          });

          this.highlightComponent(target);
        }
      },
      true,
    );
  }

  private setupOverlayUpdateListeners(): void {
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
    window.addEventListener('scroll', scheduleUpdate, {
      passive: true,
      capture: true,
    });

    // Use ResizeObserver for viewport resize
    this.resizeObserver = new ResizeObserver(scheduleUpdate);
    this.resizeObserver.observe(document.documentElement);
  }

  private highlightComponent(domNode: HTMLElement): void {
    // Store reference to selected element
    this.selectedElement = domNode;

    // Create overlay if it doesn't exist
    if (this.selectedOverlay == null) {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.backgroundColor = 'rgba(255, 165, 0, 0.3)'; // Semi-transparent orange
      overlay.style.border = '2px solid orange';
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'none'; // Allow clicks to pass through
      overlay.style.transition = 'none'; // Disable transitions for smooth updates

      document.body.appendChild(overlay);
      this.selectedOverlay = overlay;
    }

    // Update position
    this.updateOverlayPosition();
  }

  private updateOverlayPosition(): void {
    if (!this.selectedElement || !this.selectedOverlay) return;

    const rect = this.selectedElement.getBoundingClientRect();

    // Update overlay position and size
    this.selectedOverlay.style.top = `${rect.top}px`;
    this.selectedOverlay.style.left = `${rect.left}px`;
    this.selectedOverlay.style.width = `${rect.width}px`;
    this.selectedOverlay.style.height = `${rect.height}px`;
  }
}
