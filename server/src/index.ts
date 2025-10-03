#!/usr/bin/env node

/**
 * React MCP Server
 * Provides MCP tools for React development and WebSocket API for browser extension
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  type WebSocketMessage,
  safeParseWebSocketMessage,
} from "@react-mcp/core";
import { WebSocket, WebSocketServer } from "ws";
import packageJson from "../package.json" with { type: "json" };
import { ComponentState } from "./interfaces.js";
import { createWebSocketServer } from "./socket.js";

const { version } = packageJson;

class ReactMCPServer {
  private mcpServer: Server;
  private clients: Set<WebSocket> = new Set();

  private selectedComponentId: string | null = null;
  private components: Map<string, ComponentState> = new Map();

  private _wss: WebSocketServer | null = null;

  // Current active tab tracking
  private activeTabId: number | null = null;
  private lastHandshake: number | null = null;
  private lastPing: number | null = null;
  private pingCheckInterval: NodeJS.Timeout | null = null;

  private readonly PING_TIMEOUT = 15000; // 15 seconds - if no PING received, invalidate handshake

  get wss() {
    if (this._wss == null) {
      throw new Error("WebSocket server not initialized");
    }
    return this._wss;
  }

  set wss(value: WebSocketServer) {
    this._wss = value;
  }

  constructor() {
    this.mcpServer = new Server(
      {
        name: "react-mcp-server",
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  async init() {
    this.wss = await createWebSocketServer({ port: 3939 });

    this.setupWebSocket();
    this.setupMCPHandlers();
    this.startPingCheck();

    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);

    console.error("[MCP Server] MCP server started on stdio");
    console.error("[MCP Server] Ready to receive requests from Claude Desktop");
  }

  private startPingCheck() {
    // Check for PING timeout every 5 seconds
    this.pingCheckInterval = setInterval(() => {
      if (this.activeTabId !== null && this.lastPing !== null) {
        const timeSinceLastPing = Date.now() - this.lastPing;
        if (timeSinceLastPing > this.PING_TIMEOUT) {
          console.error(
            `[MCP Server] PING timeout (${timeSinceLastPing}ms since last PING), invalidating handshake for tab:`,
            this.activeTabId
          );
          this.invalidateHandshake();
        }
      }
    }, 5000);
  }

  private invalidateHandshake() {
    console.error("[MCP Server] Invalidating handshake, clearing state");
    this.activeTabId = null;
    this.lastHandshake = null;
    this.lastPing = null;
    this.components.clear();
    this.selectedComponentId = null;
  }

  private setupWebSocket() {
    this.wss.on("connection", (ws: WebSocket) => {
      console.error("[MCP Server] WebSocket client connected");
      this.clients.add(ws);

      ws.on("message", (data: Buffer) => {
        try {
          const rawMessage = JSON.parse(data.toString());

          // Validate message format
          const parsed = safeParseWebSocketMessage(rawMessage);
          if (!parsed.success) {
            console.error("[MCP Server] Invalid message format:", parsed.error);
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid message format",
              })
            );
            return;
          }

          this.handleWebSocketMessage(ws, parsed.data);
        } catch (error) {
          console.error("[MCP Server] Error parsing WebSocket message:", error);
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Failed to parse message",
            })
          );
        }
      });

      ws.on("close", () => {
        console.error("[MCP Server] WebSocket client disconnected");
        this.clients.delete(ws);
      });

      ws.on("error", (error) => {
        console.error("[MCP Server] WebSocket error:", error);
        this.clients.delete(ws);
      });

      // Send connection acknowledgment
      ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
    });

    console.error(`[MCP Server] WebSocket server listening on port 3939`);
  }

  private handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage) {
    console.error("[MCP Server] WebSocket message received:", message.type);

    switch (message.type) {
      case "HANDSHAKE": {
        const { tabId, components, selectedComponent } = message.data;

        // If this is a different tab, clear existing state
        if (this.activeTabId !== null && this.activeTabId !== tabId) {
          console.log("[MCP Server] Switching to new tab, clearing old state");
          this.components.clear();
          this.selectedComponentId = null;
        }

        this.activeTabId = tabId;
        this.lastHandshake = Date.now();
        this.lastPing = Date.now(); // Initialize lastPing on handshake
        console.log("[MCP Server] Handshake successful with tab:", tabId);

        // Sync state from HANDSHAKE
        console.log("[MCP Server] Syncing state from HANDSHAKE:", {
          componentsCount: components.length,
          hasSelectedComponent: selectedComponent != null,
        });

        // Sync components
        components.forEach((comp) => {
          const componentId = `${comp.name};${tabId}`;
          this.components.set(componentId, {
            id: comp.id,
            name: comp.name,
            file: comp.file,
            props: comp.props,
            state: comp.state,
            tabId,
            timestamp: Date.now(),
          });
        });

        // Sync selected component
        if (selectedComponent != null) {
          const selectedId = `${selectedComponent.name};${tabId}`;
          this.selectedComponentId = selectedId;
        }

        // Send handshake acknowledgment
        ws.send(JSON.stringify({ type: "HANDSHAKE_ACK", data: { tabId } }));
        break;
      }

      case "PING": {
        const { tabId } = message.data;

        // Only respond to PING from active tab
        if (this.activeTabId === tabId) {
          this.lastPing = Date.now(); // Update lastPing timestamp
          console.error("[MCP Server] PING received from active tab:", tabId);

          // Send PONG response
          ws.send(JSON.stringify({ type: "PONG", data: { tabId } }));
        } else {
          console.error(
            "[MCP Server] PING from inactive tab:",
            tabId,
            "active:",
            this.activeTabId
          );
        }
        break;
      }

      case "REACT_DETECTED":
        console.error("[MCP Server] React detected:", message.data);
        ws.send(JSON.stringify({ type: "ack", success: true }));
        break;

      case "COMPONENT_CLICKED": {
        const { id, name, props, state, tabId, file } = message.data;
        this.components.set(id, {
          id,
          name,
          file,
          props,
          state,
          tabId,
          timestamp: Date.now(),
        });
        this.selectedComponentId = id;

        console.error("[MCP Server] Component clicked:", { name, tabId, file });
        ws.send(
          JSON.stringify({ type: "ack", success: true, componentId: id })
        );
        break;
      }

      case "FIBER_COMMITED": {
        const { components, tabId } = message.data;
        console.error("[MCP Server] Fiber committed:", {
          componentsCount: components.length,
          tabId,
        });

        // Clear existing components for this tab and replace with new ones

        // Remove all components from this tab
        for (const [id, comp] of this.components.entries()) {
          if (comp.tabId === tabId || (comp.tabId == null && tabId == null)) {
            this.components.delete(id);
          }
        }

        // Add new components
        components.forEach((comp) => {
          this.components.set(comp.id, {
            id: comp.id,
            name: comp.name,
            file: comp.file,
            props: comp.props,
            state: comp.state,
            tabId,
            timestamp: Date.now(),
          });
        });

        ws.send(JSON.stringify({ type: "ack", success: true }));
        break;
      }
    }
  }

  private waitForHandshake(): Promise<void> {
    return Promise.race([
      new Promise<void>((resolve) => {
        const checkHandshake = () => {
          if (this.activeTabId != null && this.lastHandshake != null) {
            resolve();
          } else {
            setTimeout(checkHandshake, 500);
          }
        };
        checkHandshake();
      }),
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Handshake timeout"));
        }, 10000); // 30 seconds timeout
      }),
    ]);
  }

  private setupMCPHandlers() {
    // List available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "selected_component",
            description:
              "Get details of the currently selected React component in the browser",
            inputSchema: {
              type: "object",
              properties: {},
            },
            outputSchema: {
              type: "object",
              properties: {
                id: { type: "string", description: "Component ID" },
                name: { type: "string", description: "Component name" },
                file: {
                  type: "string",
                },
                timestamp: {
                  type: "string",
                  description: "ISO timestamp when component was selected",
                },
                props: {
                  type: "object",
                  description: "Component props",
                },
                state: {
                  type: "object",
                  description: "Component state",
                },
              },
              required: ["id", "name", "url", "timestamp", "props", "state"],
            },
          },
          {
            name: "list_components",
            description: "List all React components detected in the browser",
            inputSchema: {
              type: "object",
              properties: {},
            },
            outputSchema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "Component ID" },
                  name: { type: "string", description: "Component name" },
                  file: {
                    type: "string",
                  },
                  timestamp: {
                    type: "string",
                    description: "ISO timestamp when component was detected",
                  },
                  props: {
                    type: "object",
                    description: "Component props",
                  },
                  state: {
                    type: "object",
                    description: "Component state",
                  },
                },
                required: ["id", "name", "url", "timestamp", "props", "state"],
              },
            },
          },
          {
            name: "analyze_component",
            description: "Analyze a React component and provide insights",
            inputSchema: {
              type: "object",
              properties: {
                componentId: {
                  type: "string",
                  description: "The ID of the component to analyze",
                },
              },
              required: ["componentId"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const isNotHandshaken =
        this.activeTabId == null || this.lastHandshake == null;

      if (isNotHandshaken) {
        try {
          await this.waitForHandshake();
          console.log("[MCP Server] Handshake completed, proceeding");
        } catch (error) {
          console.error("[MCP Server] Handshake wait failed:", error);
          return {
            content: [
              {
                type: "text",
                text: "No active handshake with any browser tab. Please open a React page with the MCP extension installed.",
              },
            ],
            isError: true,
          };
        }
      }

      switch (name) {
        case "selected_component": {
          if (this.selectedComponentId == null) {
            return {
              content: [
                {
                  type: "text",
                  text: "No component selected. Please select a component in the browser.",
                },
              ],
              isError: true,
            };
          }

          const component = this.components.get(this.selectedComponentId);
          if (component == null) {
            return {
              content: [
                {
                  type: "text",
                  text: "Selected component data not found.",
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: "json",
                text: JSON.stringify({
                  id: this.selectedComponentId,
                  name: component.name,
                  file: component.file || "unknown",
                  timestamp: new Date(component.timestamp).toISOString(),
                  props: component.props,
                  state: component.state,
                }),
              },
            ],
          };
        }

        case "list_components": {
          const componentsArray = Array.from(this.components.entries()).map(
            ([id, comp]) => ({
              id,
              name: comp.name,
              file: comp.file || "unknown",
              timestamp: new Date(comp.timestamp).toISOString(),
              props: comp.props,
              state: comp.state,
            })
          );

          return {
            content: [
              {
                type: "json",
                text: JSON.stringify(componentsArray, null, 2),
              },
            ],
          };
        }

        case "analyze_component": {
          const componentId = args?.componentId as string;
          const component = this.components.get(componentId);

          if (!component) {
            return {
              content: [
                {
                  type: "text",
                  text: `Component not found: ${componentId}`,
                },
              ],
              isError: true,
            };
          }

          // Perform basic analysis
          const analysis: {
            name: string;
            propCount: number;
            stateCount: number;
            props: Record<string, any>;
            state: Record<string, any>;
            suggestions: string[];
          } = {
            name: component.name,
            propCount: Object.keys(component.props).length,
            stateCount: Object.keys(component.state).length,
            props: component.props,
            state: component.state,
            suggestions: [],
          };

          // Add suggestions based on component data
          if (Object.keys(component.props).length > 10) {
            analysis.suggestions.push(
              "Consider breaking this component into smaller components - it has many props"
            );
          }

          return {
            content: [
              {
                type: "text",
                text: `Component Analysis:\n\n${JSON.stringify(
                  analysis,
                  null,
                  2
                )}`,
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    });

    let originalClose = this.mcpServer.close;
    this.mcpServer.close = async () => {
      await originalClose.call(this.mcpServer);

      // Clean up ping check interval
      if (this.pingCheckInterval) {
        clearInterval(this.pingCheckInterval);
        this.pingCheckInterval = null;
      }

      this.wss.close();
      console.error("[MCP Server] MCP server and WebSocket server closed");
    };
  }
}

const server = new ReactMCPServer();
server.init().catch((error) => {
  console.error("[MCP Server] Failed to start:", error);
  process.exit(1);
});
