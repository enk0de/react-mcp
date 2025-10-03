/// <reference path="../.wxt/wxt.d.ts" />

import { safeParseContentMessage } from "@react-mcp/core";
import { onMessage, sendMessage } from "../libs/messaging";

/**
 * Content script bridge (ISOLATED world)
 * Receives messages from MAIN world and forwards to background script
 * Also provides storage access to MAIN world
 */

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  // ISOLATED world (default) - has access to chrome API
  async main() {
    console.log("[React MCP Bridge] Listening for messages from MAIN world...");

    // Listen for messages from MAIN world content script
    window.addEventListener("message", async (event) => {
      // Only accept messages from same window
      if (event.source !== window) return;

      const message = event.data;

      // Check if it's a message from our MAIN world script
      if (message?.source === "react-mcp-main") {
        console.log("[React MCP Bridge] Forwarding to background:", message);

        // Validate content message
        const parsed = safeParseContentMessage({
          type: message.type,
          data: message.data,
        });

        if (!parsed.success) {
          console.error(
            "[React MCP Bridge] Invalid content message:",
            parsed.error
          );
          return;
        }

        // Forward to background script using @webext-core/messaging
        sendMessage("contentToBackground", parsed.data);
      }
    });

    // Listen for messages from background script
    onMessage("backgroundToContent", (message) => {
      console.log("[React MCP Bridge] Message from background:", message);

      // Forward to MAIN world content script
      window.postMessage(
        {
          source: "react-mcp-bridge",
          type: message.type,
          data: message.data,
        },
        "*"
      );
    });
  },
});
