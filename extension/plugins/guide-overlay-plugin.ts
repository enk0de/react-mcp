import type { Plugin, PluginContext } from "../types/plugin";
import { GuideOverlay } from "../libs/guide-overlay";

/**
 * Plugin that displays the guide overlay with usage instructions
 */
export class GuideOverlayPlugin implements Plugin {
  readonly name = "GuideOverlayPlugin";

  private guideOverlay: GuideOverlay;

  constructor(_context: PluginContext) {
    this.guideOverlay = new GuideOverlay();
  }

  init(): void {
    this.guideOverlay.create();
  }

  destroy(): void {
    this.guideOverlay.dispose();
  }
}
