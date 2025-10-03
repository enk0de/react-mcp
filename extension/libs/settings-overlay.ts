import { PluginContext } from "../types/plugin";

export class PopupTriggerOverlay {
  private container: HTMLElement | null = null;
  private abortController: AbortController = new AbortController();

  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  create(parent: HTMLElement) {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.justifyContent = "center";
    container.style.gap = "8px";
    container.style.backgroundColor = "rgba(23, 23, 23, 0.9)";
    container.style.borderRadius = "12px";
    container.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.25)";
    container.style.width = "40px";
    container.style.height = "40px";
    container.style.color = "#ffffff";
    container.style.fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    container.style.fontSize = "16px";
    container.style.lineHeight = "1.4";
    container.style.pointerEvents = "auto";
    container.style.cursor = "pointer";
    container.style.textOverflow = "clip";
    container.style.overflow = "hidden";
    container.style.whiteSpace = "nowrap";
    container.textContent = "⚙";

    container.setAttribute("aria-label", "Open React MCP Settings");
    container.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.context.sendMessage({ type: "OPEN_SETTINGS_POPUP" });
      },
      {
        signal: this.abortController.signal,
      }
    );

    parent.appendChild(container);
    this.container = container;
  }

  dispose() {
    this.abortController.abort();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
