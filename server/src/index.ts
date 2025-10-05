#!/usr/bin/env node

/**
 * React MCP Server
 * Provides MCP tools for React development and WebSocket API for browser extension
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  DEFAULT_PORT,
  MCPServerMessage,
  type WebSocketMessage,
  safeParseWebSocketMessage,
} from '@react-mcp/core';
import { WebSocket, WebSocketServer } from 'ws';
import packageJson from '../package.json' with { type: 'json' };
import { parsePort } from './cli.js';
import { ComponentState } from './interfaces.js';
import { createWebSocketServer } from './socket.js';

const { version } = packageJson;

class ReactMCPServer {
  private mcpServer: Server;

  private selectedComponentId: string | null = null;
  private components: Map<string, ComponentState> = new Map();

  private _wss: WebSocketServer | null = null;

  private activeTabId: number | null = null;

  private readonly PING_TIMEOUT = 15000; // 15 seconds - if no PING received, invalidate handshake

  get wss() {
    if (this._wss == null) {
      throw new Error('WebSocket server not initialized');
    }
    return this._wss;
  }

  set wss(value: WebSocketServer) {
    this._wss = value;
  }

  constructor() {
    this.mcpServer = new Server(
      {
        name: 'react-mcp-server',
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
  }

  async init(port: number = DEFAULT_PORT) {
    this.wss = await createWebSocketServer({ port });

    this.setupWebSocket();
    this.setupMCPHandlers();

    const transport = new StdioServerTransport();
    await this.mcpServer.connect(transport);

    console.error('[MCP Server] MCP server started on stdio');
    console.error('[MCP Server] Ready to receive requests from Claude Desktop');
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.error('[MCP Server] WebSocket client connected');

      ws.on('message', (data: Buffer) => {
        try {
          const rawMessage = JSON.parse(data.toString());

          // Validate message format
          const parsed = safeParseWebSocketMessage(rawMessage);
          if (!parsed.success) {
            console.error('[MCP Server] Invalid message format:', parsed.error);
            return;
          }

          this.handleWebSocketMessage(ws, parsed.data);
        } catch (error) {
          console.error('[MCP Server] Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.error('[MCP Server] WebSocket client disconnected');
      });

      ws.on('error', (error) => {
        console.error('[MCP Server] WebSocket error:', error);
      });
    });

    console.error(
      `[MCP Server] WebSocket server listening on port ${this.wss.options.port}`,
    );
  }

  private handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage) {
    console.error('[MCP Server] WebSocket message received:', message.type);

    switch (message.type) {
      case 'SET_STATE': {
        const { tabId, components, selectedComponent } = message.data;

        // If this is a different tab, clear existing state
        if (this.activeTabId !== null && this.activeTabId !== tabId) {
          console.log('[MCP Server] Switching to new tab, clearing old state');
          this.components.clear();
          this.selectedComponentId = null;
        }

        this.activeTabId = tabId;
        console.log('[MCP Server] Handshake successful with tab:', tabId);

        // Sync state from HANDSHAKE
        console.log('[MCP Server] Syncing state from HANDSHAKE:', {
          componentsCount: components.length,
          hasSelectedComponent: selectedComponent != null,
        });

        // Sync components
        components.forEach((comp) => {
          this.components.set(comp.id, {
            id: comp.id,
            name: comp.name,
            props: comp.props,
            state: comp.state,
            tabId,
            source: comp.source,
          });
        });

        // Sync selected component
        if (selectedComponent != null) {
          this.selectedComponentId = selectedComponent.id;
        }

        break;
      }

      case 'SELECT_COMPONENT': {
        const { id, tabId } = message.data;

        if (tabId !== this.activeTabId) {
          console.error(
            '[MCP Server] SELECT_COMPONENT from unknown tab, setState first:',
            tabId,
          );
          this.sendMessage({
            type: 'REQUEST_INITIAL_STATE',
            data: {
              tabId,
            },
          });
        }

        this.selectedComponentId = id;

        console.error('[MCP Server] Component clicked:', id);
        break;
      }
    }
  }

  private sendMessage(message: MCPServerMessage) {
    const messageString = JSON.stringify(message);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }

  private setupMCPHandlers() {
    // List available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'selected_component',
            description:
              'Get details of the currently selected React component in the browser. IMPORTANT: When modifying code that renders props like {name}, DO NOT modify the JSX template directly. Instead, go to the parent component that renders this component and modify the prop value being passed there.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            outputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Component ID',
                },
                name: {
                  type: 'string',
                  description: 'Component name',
                },
                source: {
                  type: ['object', 'null'],
                  description:
                    'Source file information ([IMPORTANT] useful for locating component in codebase)',
                  properties: {
                    fileName: {
                      type: 'string',
                      description: 'Source file location',
                    },
                    lineNumber: {
                      type: 'number',
                      description: 'Line number in source file',
                    },
                    columnNumber: {
                      type: 'number',
                      description: 'Column number in source file',
                    },
                  },
                  required: ['fileName', 'lineNumber', 'columnNumber'],
                },
                props: {
                  type: 'object',
                  description: 'Component props',
                },
                state: {
                  type: 'object',
                  description: 'Component state',
                },
              },
              required: ['id', 'name', 'source', 'props', 'state'],
            },
          },
          {
            name: 'list_components',
            description:
              'List all React components detected in the browser. IMPORTANT: When modifying code that renders props like {name}, DO NOT modify the JSX template directly. Instead, go to the parent component that renders this component and modify the prop value being passed there.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            outputSchema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string',
                    description: 'Component ID',
                  },
                  name: {
                    type: 'string',
                    description: 'Component name',
                  },
                  source: {
                    type: ['object', 'null'],
                    description:
                      'Source file information ([IMPORTANT] useful for locating component in codebase)',
                    properties: {
                      fileName: {
                        type: 'string',
                        description: 'Source file location',
                      },
                      lineNumber: {
                        type: 'number',
                        description: 'Line number in source file',
                      },
                      columnNumber: {
                        type: 'number',
                        description: 'Column number in source file',
                      },
                    },
                    required: ['fileName', 'lineNumber', 'columnNumber'],
                  },
                  props: {
                    type: 'object',
                    description: 'Component props',
                  },
                  state: {
                    type: 'object',
                    description: 'Component state',
                  },
                },
                required: ['id', 'name', 'source', 'props', 'state'],
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const noActiveTab = this.activeTabId == null;

      if (noActiveTab) {
        console.error('[MCP Server] Handshake wait failed:');
        return {
          content: [
            {
              type: 'text',
              text: 'No active handshake with any browser tab. Please open a React page with the MCP extension installed.',
            },
          ],
          isError: true,
        };
      }

      switch (name) {
        case 'selected_component': {
          if (this.selectedComponentId == null) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'No component selected. Please select a component in the browser.',
                },
              ],
              isError: true,
            };
          }

          const component = this.components.get(this.selectedComponentId);
          console.error(
            '[MCP Server] Fetching selected component:',
            this.selectedComponentId,
            component,
          );
          if (component == null) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Selected component data not found.',
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              {
                type: 'json',
                text: JSON.stringify(component),
              },
            ],
          };
        }

        case 'list_components': {
          const componentsArray = Array.from(this.components.entries());

          return {
            content: [
              {
                type: 'json',
                text: JSON.stringify(componentsArray, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
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

      this.wss.close();
      console.error('[MCP Server] MCP server and WebSocket server closed');
    };
  }
}

const server = new ReactMCPServer();
const port = parsePort();

server.init(port).catch((error) => {
  console.error('[MCP Server] Failed to start:', error);
  process.exit(1);
});
