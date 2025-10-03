import { z } from "zod";

/**
 * Message schemas and types for type-safe communication between
 * content scripts, background script, and MCP server
 */

// ============================================================================
// Shared Data Schemas
// ============================================================================

const RenderedComponentDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  props: z.record(z.any(), z.any()),
  state: z.record(z.any(), z.any()),
});

export type RenderedComponentData = z.infer<typeof RenderedComponentDataSchema>;

// ============================================================================
// Content Script → Background Script (Or Just Bridge) Messages
// ============================================================================

const ContentMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FIBER_COMMITED"),
    data: z.array(RenderedComponentDataSchema),
  }),
  z.object({
    type: z.literal("REACT_DETECTED"),
    data: z.undefined().optional(),
  }),
  z.object({
    type: z.literal("COMPONENT_CLICKED"),
    data: RenderedComponentDataSchema,
  }),
  z.object({
    type: z.literal("STATE_FOR_HANDSHAKE"),
    data: z.object({
      components: z.array(RenderedComponentDataSchema),
      selectedComponent: RenderedComponentDataSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal("OPEN_SETTINGS_POPUP"),
    data: z.undefined().optional(),
  }),
]);

export type ContentMessage = z.infer<typeof ContentMessageSchema>;

/**
 * Validate and parse content message
 */
export function parseContentMessage(data: unknown): ContentMessage {
  return ContentMessageSchema.parse(data);
}

/**
 * Safe parse that returns success/error result
 */
export function safeParseContentMessage(data: unknown) {
  return ContentMessageSchema.safeParse(data);
}

// ============================================================================
// Background Script → Content Script Messages
// ============================================================================

const BackgroundMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TOGGLE_FEATURES"),
    data: z.undefined().optional(),
  }),
  z.object({
    type: z.literal("REQUEST_STATE_FOR_HANDSHAKE"),
    data: z.undefined().optional(),
  }),
]);

export type BackgroundMessage = z.infer<typeof BackgroundMessageSchema>;

/**
 * Validate and parse background message
 */
export function parseBackgroundMessage(data: unknown): BackgroundMessage {
  return BackgroundMessageSchema.parse(data);
}

/**
 * Safe parse that returns success/error result
 */
export function safeParseBackgroundMessage(data: unknown) {
  return BackgroundMessageSchema.safeParse(data);
}

// ============================================================================
// Background Script → MCP Server Messages (WebSocket)
// ============================================================================

const WebSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("HANDSHAKE"),
    data: z.object({
      tabId: z.number(),
      components: z.array(RenderedComponentDataSchema),
      selectedComponent: RenderedComponentDataSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal("PING"),
    data: z.object({
      tabId: z.number(),
    }),
  }),
  z.object({
    type: z.literal("FIBER_COMMITED"),
    data: z.object({
      components: z.array(RenderedComponentDataSchema),
      tabId: z.number(),
    }),
  }),
  z.object({
    type: z.literal("REACT_DETECTED"),
    data: z.object({
      tabId: z.number(),
    }),
  }),
  z.object({
    type: z.literal("COMPONENT_CLICKED"),
    data: RenderedComponentDataSchema.extend({
      tabId: z.number(),
    }),
  }),
]);

// ============================================================================
// MCP Server → Background Script Messages (WebSocket)
// ============================================================================

const MCPServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("HANDSHAKE_ACK"),
    data: z.object({
      tabId: z.number(),
    }),
  }),
  z.object({
    type: z.literal("PONG"),
    data: z.object({
      tabId: z.number(),
    }),
  }),
]);

export type MCPServerMessage = z.infer<typeof MCPServerMessageSchema>;

/**
 * Validate and parse MCP server message
 */
export function parseMCPServerMessage(data: unknown): MCPServerMessage {
  return MCPServerMessageSchema.parse(data);
}

/**
 * Safe parse that returns success/error result
 */
export function safeParseMCPServerMessage(data: unknown) {
  return MCPServerMessageSchema.safeParse(data);
}

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/**
 * Validate and parse WebSocket message
 */
export function parseWebSocketMessage(data: unknown): WebSocketMessage {
  return WebSocketMessageSchema.parse(data);
}

/**
 * Safe parse that returns success/error result
 */
export function safeParseWebSocketMessage(data: unknown) {
  return WebSocketMessageSchema.safeParse(data);
}

// ============================================================================
// Type Guards
// ============================================================================

export function isContentMessage(data: unknown): data is ContentMessage {
  return ContentMessageSchema.safeParse(data).success;
}

export function isBackgroundMessage(data: unknown): data is BackgroundMessage {
  return BackgroundMessageSchema.safeParse(data).success;
}

export function isWebSocketMessage(data: unknown): data is WebSocketMessage {
  return WebSocketMessageSchema.safeParse(data).success;
}

export function isMCPServerMessage(data: unknown): data is MCPServerMessage {
  return MCPServerMessageSchema.safeParse(data).success;
}
