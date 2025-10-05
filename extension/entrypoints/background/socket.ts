import {
  MCPServerMessage,
  parseWebSocketMessage,
  safeParseMCPServerMessage,
  WebSocketMessage,
} from "@react-mcp/core";
import { PortStorage } from "../../libs/storage/port";

interface SocketConnectionConfig {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: () => void;
  onMessage?: (data: MCPServerMessage) => void;
}

export class SocketConnection {
  private static RECONNECT_TIMEOUT = 1500; // 1.5 seconds

  private ws: WebSocket | null = null;
  private isConnected: boolean = false;

  private port: PortStorage;
  private config?: SocketConnectionConfig;

  dispose: () => void = () => {};

  constructor(port: PortStorage, config?: SocketConnectionConfig) {
    this.port = port;
    this.config = config;
  }

  async start() {
    this.connect();

    this.dispose = this.port.watch((oldPort, newPort) => {
      console.log(
        `[React MCP Background] Port changed from ${oldPort} to ${newPort}, reconnecting...`
      );
      this.disconnect();
      this.connect();
    });
  }

  sendMessage(message: WebSocketMessage) {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      const validated = parseWebSocketMessage(message);
      this.ws.send(JSON.stringify(validated));
      return true;
    } else {
      console.error(
        "[React MCP Background] Cannot send message, WebSocket not connected"
      );
      return false;
    }
  }

  private async connect() {
    console.log("[React MCP Background] Connect WebSocket");

    try {
      const port = await this.port.get();
      this.ws = new WebSocket(`ws://localhost:${port}`);

      this.ws.onopen = () => {
        console.log("[React MCP Background] WebSocket connected");
        this.onConnected();
      };

      this.ws.onmessage = (event) => {
        this.onMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log("[React MCP Background] WebSocket disconnected");
        this.onClose();
      };

      this.ws.onerror = (error) => {
        console.error("[React MCP Background] WebSocket error:", error);
        this.onError();
      };
    } catch (error) {
      console.error("[React MCP Background] Error creating WebSocket:", error);
      this.reconnect();
    }
  }

  private async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  private onConnected() {
    this.isConnected = true;
    this.config?.onConnected?.();
  }

  private onMessage(data: any) {
    try {
      const message = JSON.parse(data);
      console.log(
        "[React MCP Background] WebSocket message received:",
        message
      );

      // Handle MCP server messages
      const parsed = safeParseMCPServerMessage(message);
      if (!parsed.success) {
        return;
      }

      this.config?.onMessage?.(parsed.data);
    } catch (error) {
      console.error(
        "[React MCP Background] Error parsing WebSocket message:",
        error
      );
    }
  }

  private reconnect() {
    setTimeout(() => {
      this.connect();
    }, SocketConnection.RECONNECT_TIMEOUT);
  }

  private onClose() {
    this.disconnect();
    this.config?.onDisconnected?.();
    this.reconnect();
  }

  private onError() {
    this.config?.onError?.();
  }
}
