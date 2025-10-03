import { PluginContext } from "../types/plugin";
import { GuideOverlay } from "./guide-overlay";
import { PopupTriggerOverlay } from "./settings-overlay";

export class OverlayManager {
  private container: HTMLElement | null = null;
  private guideOverlay: GuideOverlay;
  private popupTriggerOverlay: PopupTriggerOverlay;

  constructor(context: PluginContext) {
    this.guideOverlay = new GuideOverlay();
    this.popupTriggerOverlay = new PopupTriggerOverlay(context);
  }

  init() {
    const createContainer = () => {
      this.container = document.createElement("div");
      this.container.style.position = "fixed";
      this.container.style.right = "16px";
      this.container.style.bottom = "16px";
      this.container.style.zIndex = "99999";
      this.container.style.display = "flex";
      this.container.style.flexDirection = "column";
      this.container.style.alignItems = "flex-end";
      this.container.style.gap = "8px";
      this.container.style.pointerEvents = "none";

      document.body.appendChild(this.container);

      this.guideOverlay.create(this.container);
      this.popupTriggerOverlay.create(this.container);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createContainer, {
        once: true,
        passive: true,
      });
    } else {
      createContainer();
    }
  }

  destroy() {
    this.guideOverlay.dispose();
    this.popupTriggerOverlay.dispose();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  showGuide() {
    this.guideOverlay.show();
  }

  hideGuide() {
    this.guideOverlay.hide();
  }
}
