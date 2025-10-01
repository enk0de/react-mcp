/// <reference path="../.wxt/wxt.d.ts" />

import {
  type ContentMessage,
  type MCPServerMessage,
  parseWebSocketMessage,
  safeParseContentMessage,
  safeParseMCPServerMessage,
  type WebSocketMessage,
} from "../types/messages";

/**
 * Background service worker that communicates with MCP server via WebSocket
 */

export default defineBackground({
  main() {
    init();
  },
});

const mcpServerUrl = "ws://localhost:3939";
let ws: WebSocket | null = null;
let isConnected = false;
let reconnectTimer: number | null = null;

// Handshake state per tab
const handshakeState = new Map<
  number,
  {
    isHandshaked: boolean;
    lastPing: number;
    pingInterval: number | null;
    pongTimeout: number | null;
  }
>();

const PING_INTERVAL = 2500; // 2.5 seconds
const PONG_TIMEOUT = 10000; // 10 seconds
const RECONNECT_INTERVAL = 5000; // 5 seconds

function init() {
  console.log("[React MCP Background] Initializing...");

  // Connect to WebSocket
  connectWebSocket();

  // Listen for messages from content scripts
  chrome.runtime.onMessage.addListener(
    (message: unknown, sender, sendResponse) => {
      console.log("[React MCP Background] Received message:", message);

      const parsed = safeParseContentMessage(message);
      if (!parsed.success) {
        console.error(
          "[React MCP Background] Invalid message format:",
          parsed.error
        );
        return false; // Don't keep channel open
      }

      handleContentMessage(parsed.data, sender);
      return false; // Don't keep channel open for async response
    }
  );

  // Listen for extension icon clicks
  chrome.action.onClicked.addListener((tab) => {
    handleIconClick(tab);
  });

  console.log("[React MCP Background] Initialization complete");
}

function connectWebSocket() {
  try {
    console.log("[React MCP Background] Connecting to WebSocket...");
    ws = new WebSocket(mcpServerUrl);

    ws.onopen = () => {
      console.log("[React MCP Background] WebSocket connected");
      isConnected = true;

      // Clear reconnect timer
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Re-establish handshakes for all tabs with React
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            attemptHandshake(tab.id);
          }
        });
      });
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(
          "[React MCP Background] WebSocket message received:",
          message
        );

        // Handle MCP server messages
        const parsed = safeParseMCPServerMessage(message);
        if (parsed.success) {
          handleMCPServerMessage(parsed.data);
          return;
        }

        console.log("[React MCP Background] Non-command message:", message);
      } catch (error) {
        console.error(
          "[React MCP Background] Error parsing WebSocket message:",
          error
        );
      }
    };

    ws.onclose = () => {
      console.log("[React MCP Background] WebSocket disconnected");
      isConnected = false;
      ws = null;

      // Attempt to reconnect after 5 seconds
      if (reconnectTimer === null) {
        attachReconnectTimerIfNeeded();
      }
    };

    ws.onerror = (error) => {
      console.error("[React MCP Background] WebSocket error:", error);
      isConnected = false;
    };
  } catch (error) {
    console.error("[React MCP Background] Error creating WebSocket:", error);
    isConnected = false;
    attachReconnectTimerIfNeeded();
  }
}

function attachReconnectTimerIfNeeded() {
  if (reconnectTimer === null) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, RECONNECT_INTERVAL) as unknown as number;
  }
}

function sendWebSocketMessage(message: WebSocketMessage) {
  if (!ws || !isConnected || ws.readyState !== WebSocket.OPEN) {
    console.warn(
      "[React MCP Background] WebSocket not connected, queueing message"
    );
    // Try to reconnect
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectWebSocket();
    }
    return false;
  }

  try {
    // Validate message before sending
    const validated = parseWebSocketMessage(message);
    ws.send(JSON.stringify(validated));
    return true;
  } catch (error) {
    console.error(
      "[React MCP Background] Error sending WebSocket message:",
      error
    );
    return false;
  }
}

function handleMCPServerMessage(message: MCPServerMessage) {
  console.log("[React MCP Background] Handling MCP server message:", message);

  switch (message.type) {
    case "HANDSHAKE_ACK": {
      const { tabId } = message.data;
      const state = handshakeState.get(tabId);
      if (state) {
        state.isHandshaked = true;
        console.log(
          "[React MCP Background] Handshake confirmed for tab:",
          tabId
        );

        // Start ping interval
        startPingInterval(tabId);
      }
      break;
    }

    case "PONG": {
      const { tabId } = message.data;
      const state = handshakeState.get(tabId);
      if (state) {
        // Clear pong timeout
        if (state.pongTimeout !== null) {
          clearTimeout(state.pongTimeout);
          state.pongTimeout = null;
        }
        state.lastPing = Date.now();
        console.log("[React MCP Background] PONG received from tab:", tabId);
      }
      break;
    }
  }
}

function startPingInterval(tabId: number) {
  const state = handshakeState.get(tabId);
  if (!state) return;

  // Clear existing interval
  if (state.pingInterval !== null) {
    clearInterval(state.pingInterval);
  }

  // Start new ping interval
  state.pingInterval = setInterval(() => {
    if (!ws || !isConnected) {
      console.log(
        "[React MCP Background] WebSocket not connected, stopping ping"
      );
      stopPingInterval(tabId);
      return;
    }

    console.log("[React MCP Background] Sending PING to tab:", tabId);
    sendWebSocketMessage({ type: "PING", data: { tabId } });

    // Set pong timeout
    state.pongTimeout = setTimeout(() => {
      console.error("[React MCP Background] PONG timeout for tab:", tabId);
      handleConnectionLost(tabId);
    }, PONG_TIMEOUT) as unknown as number;
  }, PING_INTERVAL) as unknown as number;
}

function stopPingInterval(tabId: number) {
  const state = handshakeState.get(tabId);
  if (!state) return;

  if (state.pingInterval !== null) {
    clearInterval(state.pingInterval);
    state.pingInterval = null;
  }

  if (state.pongTimeout !== null) {
    clearTimeout(state.pongTimeout);
    state.pongTimeout = null;
  }
}

function handleConnectionLost(tabId: number) {
  console.log("[React MCP Background] Connection lost for tab:", tabId);

  const state = handshakeState.get(tabId);
  if (state) {
    state.isHandshaked = false;
    stopPingInterval(tabId);
  }

  // Try to re-establish handshake
  attemptHandshake(tabId);
}

function attemptHandshake(tabId: number) {
  if (!ws || !isConnected) {
    console.log(
      "[React MCP Background] Cannot handshake, WebSocket not connected"
    );
    return;
  }

  console.log("[React MCP Background] Attempting handshake for tab:", tabId);

  stopPingInterval(tabId);

  // Request state from content script for handshake
  chrome.tabs
    .sendMessage(tabId, { type: "REQUEST_STATE_FOR_HANDSHAKE" })
    .catch(() => {
      console.log(
        "[React MCP Background] Failed to request state for handshake"
      );
    });
}

function handleContentMessage(
  message: ContentMessage,
  sender: chrome.runtime.MessageSender
) {
  console.log("[React MCP Background] Message from content script:", message);

  const tabId = sender.tab?.id;

  if (tabId == null) {
    console.error(
      "[React MCP Background] Cannot handle message, missing tab ID",
      message,
      sender
    );
    return;
  }

  // If REACT_DETECTED, request state for handshake
  if (message.type === "REACT_DETECTED") {
    // Request state from content script for handshake
    chrome.tabs
      .sendMessage(tabId, { type: "REQUEST_STATE_FOR_HANDSHAKE" })
      .catch(() => {
        console.log(
          "[React MCP Background] Failed to request state for handshake"
        );
      });
    return;
  }

  // Transform content message to WebSocket message with proper typing
  let wsMessage: WebSocketMessage;

  switch (message.type) {
    case "FIBER_COMMITED":
      wsMessage = {
        type: "FIBER_COMMITED",
        data: {
          components: message.data,
          tabId,
        },
      };
      break;

    case "COMPONENT_CLICKED":
      wsMessage = {
        type: "COMPONENT_CLICKED",
        data: {
          ...message.data,
          tabId,
        },
      };
      break;

    case "REACT_ERROR":
      wsMessage = {
        type: "REACT_ERROR",
        data: {
          ...message.data,
          tabId,
        },
      };
      break;

    case "STATE_FOR_HANDSHAKE":
      // Initialize handshake state
      handshakeState.set(tabId, {
        isHandshaked: false,
        lastPing: Date.now(),
        pingInterval: null,
        pongTimeout: null,
      });

      // Send HANDSHAKE with state data
      wsMessage = {
        type: "HANDSHAKE",
        data: {
          tabId,
          ...message.data,
        },
      };
      break;
  }

  sendWebSocketMessage(wsMessage);
}

function handleIconClick(tab: chrome.tabs.Tab) {
  console.log("[React MCP Background] Extension icon clicked for tab:", tab.id);

  // Send message to content script to toggle features
  if (tab.id) {
    chrome.tabs
      .sendMessage(tab.id, { type: "TOGGLE_FEATURES" })
      .catch((error) => {
        console.error(
          "[React MCP Background] Error sending message to content script:",
          error
        );
      });
  }
}
