/// <reference path="../.wxt/wxt.d.ts" />

import {
  type ContentMessage,
  type MCPServerMessage,
  parseWebSocketMessage,
  safeParseMCPServerMessage,
  type WebSocketMessage,
} from "@react-mcp/core";
import { onMessage, sendMessage } from "../libs/messaging";
import { PortStorage } from "../libs/storage/port";

/**
 * Background service worker that communicates with MCP server via WebSocket
 */

export default defineBackground({
  main() {
    init();
  },
});

let ws: WebSocket | null = null;
let isConnected = false;
let reconnectTimer: number | null = null;
const portManager = new PortStorage();

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

  // Listen for port changes and reconnect
  portManager.watch((oldPort, newPort) => {
    console.log(
      `[React MCP Background] Port changed from ${oldPort} to ${newPort}, reconnecting...`
    );
    disconnectWebSocket();
    connectWebSocket();
  });

  // Listen for messages from content scripts
  onMessage("contentToBackground", ({ data, sender }) => {
    console.log("[React MCP Background] Received message:", data);
    handleContentMessage(data, sender);
  });

  // Listen for extension icon clicks
  chrome.action.onClicked.addListener((tab) => {
    handleIconClick(tab);
  });

  console.log("[React MCP Background] Initialization complete");
}

function disconnectWebSocket() {
  if (ws) {
    console.log("[React MCP Background] Disconnecting WebSocket...");
    ws.close();
    ws = null;
    isConnected = false;
  }

  // Clear all handshake states
  handshakeState.forEach((state, tabId) => {
    stopPingInterval(tabId);
  });
  handshakeState.clear();
}

async function connectWebSocket() {
  try {
    const port = await portManager.get();
    const mcpServerUrl = `ws://localhost:${port}`;
    console.log(
      `[React MCP Background] Connecting to WebSocket at ${mcpServerUrl}...`
    );
    ws = new WebSocket(mcpServerUrl);

    ws.onopen = () => {
      console.log("[React MCP Background] WebSocket connected");
      isConnected = true;

      // Clear reconnect timer
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      console.log("from connect websocket open");
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
        if (state.pongTimeout != null) {
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
    if (state.pongTimeout != null) {
      clearTimeout(state.pongTimeout);
    }

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

  console.log("from connection lost/");

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
  sendMessage(
    "backgroundToContent",
    { type: "REQUEST_STATE_FOR_HANDSHAKE" },
    tabId
  );
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

  // Handle OPEN_SETTINGS_POPUP
  if (message.type === "OPEN_SETTINGS_POPUP") {
    chrome.action.openPopup().catch((error) => {
      console.error("[React MCP Background] Failed to open popup:", error);
    });
    return;
  }

  // If REACT_DETECTED, request state for handshake
  if (message.type === "REACT_DETECTED") {
    // Request state from content script for handshake
    sendMessage(
      "backgroundToContent",
      { type: "REQUEST_STATE_FOR_HANDSHAKE" },
      tabId
    );
    return;
  }

  sendWebSocketMessage(createWebSocketMessage(message, tabId));
}

function handleIconClick(tab: chrome.tabs.Tab) {
  console.log("[React MCP Background] Extension icon clicked for tab:", tab.id);

  // Send message to content script to toggle features
  if (tab.id) {
    sendMessage("backgroundToContent", { type: "TOGGLE_FEATURES" }, tab.id);
  }
}

function createWebSocketMessage(
  message: ContentMessage,
  tabId: number
): WebSocketMessage {
  switch (message.type) {
    case "FIBER_COMMITED":
      return {
        type: "FIBER_COMMITED",
        data: {
          components: message.data,
          tabId,
        },
      };

    case "COMPONENT_CLICKED":
      return {
        type: "COMPONENT_CLICKED",
        data: {
          ...message.data,
          tabId,
        },
      };

    case "STATE_FOR_HANDSHAKE":
      handshakeState.set(tabId, {
        isHandshaked: false,
        lastPing: Date.now(),
        pingInterval: null,
        pongTimeout: null,
      });

      return {
        type: "HANDSHAKE",
        data: {
          tabId,
          ...message.data,
        },
      };

    default:
      throw new Error(`Unsupported content message type: ${message.type}`);
  }
}
