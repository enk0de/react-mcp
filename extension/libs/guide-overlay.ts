import { cubicBezier } from "motion";
import { animate } from "motion/mini";

export class GuideOverlay {
  private container: HTMLElement | null = null;
  private guideCollapseTimeoutId: number | null = null;

  private abortController: AbortController = new AbortController();

  constructor() {}

  create() {
    const create = () => {
      const container = document.createElement("div");
      container.style.position = "fixed";
      container.style.right = "16px";
      container.style.bottom = "16px";
      container.style.zIndex = "99999";
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
      container.style.fontSize = "13px";
      container.style.lineHeight = "1.4";
      container.style.pointerEvents = "auto";
      container.style.textOverflow = "clip";
      container.style.overflow = "hidden";
      container.style.whiteSpace = "nowrap";
      container.textContent = "?";
      // "Press Alt and Click a rendered component to notify MCP Server.";

      container.setAttribute("aria-label", "Open React MCP Guide");
      container.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.show();
        },
        {
          signal: this.abortController.signal,
        }
      );

      document.body.appendChild(container);

      this.container = container;
      this.show();
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", create, {
        once: true,
        passive: true,
      });
    } else {
      create();
    }
  }

  show() {
    if (!this.container) return;

    animate(
      this.container,
      {
        width: "270px",
        height: "60px",
        padding: "12px",
      },
      { duration: 0.5, ease: cubicBezier(0.25, 1, 0.5, 1) }
    );
    this.container.style.pointerEvents = "none";
    this.container.innerHTML =
      "Press Alt and Click a rendered component<br/>to notify MCP Server.";
    this.container.style.fontSize = "12px";
    this.container.style.cursor = "default";

    this.scheduleGuideCollapse();
  }

  hide() {
    if (!this.container) return;

    animate(
      this.container,
      {
        pointerEvents: "auto",
        width: "40px",
        height: "40px",
        padding: "0",
      },
      { duration: 0.5, ease: cubicBezier(0.25, 1, 0.5, 1) }
    );

    this.container.textContent = "?";
    this.container.style.fontSize = "16px";
    this.container.style.cursor = "pointer";
  }

  dispose() {
    this.abortController.abort();
    this.clearGuideCollapseTimer();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  private scheduleGuideCollapse() {
    if (this.guideCollapseTimeoutId != null) {
      window.clearTimeout(this.guideCollapseTimeoutId);
    }

    this.guideCollapseTimeoutId = window.setTimeout(() => {
      this.guideCollapseTimeoutId = null;
      this.hide();
    }, 5000);
  }

  private clearGuideCollapseTimer() {
    if (this.guideCollapseTimeoutId != null) {
      window.clearTimeout(this.guideCollapseTimeoutId);
    }

    this.guideCollapseTimeoutId = null;
  }
}
