/// <reference path="../.wxt/wxt.d.ts" />

import { safeParseBackgroundMessage } from "../types/messages";

/**
 * Content script bridge (ISOLATED world)
 * Receives messages from MAIN world and forwards to background script
 */

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  // ISOLATED world (default) - has access to chrome API
  async main() {
    console.log("[React MCP Bridge] Listening for messages from MAIN world...");

    // Listen for messages from MAIN world content script
    window.addEventListener("message", (event) => {
      // Only accept messages from same window
      if (event.source !== window) return;

      const message = event.data;

      // Check if it's a message from our MAIN world script
      if (message?.source === "react-mcp-main") {
        console.log("[React MCP Bridge] Forwarding to background:", message);

        // Forward to background script using chrome API
        chrome.runtime
          .sendMessage({
            type: message.type,
            data: message.data,
          })
          .catch((error) => {
            console.error(
              "[React MCP Bridge] Error sending to background:",
              error
            );
          });
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("[React MCP Bridge] Message from background:", message);

      // Validate message
      const parsed = safeParseBackgroundMessage(message);
      if (!parsed.success) {
        console.error(
          "[React MCP Bridge] Invalid message format:",
          parsed.error
        );
        return;
      }

      // Forward to MAIN world content script
      window.postMessage(
        {
          source: "react-mcp-bridge",
          type: parsed.data.type,
          data: parsed.data.data,
        },
        "*"
      );
    });
  },
});
