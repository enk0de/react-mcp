import { z } from 'zod';

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
  props: z.record(z.any(), z.any()),
  state: z.record(z.any(), z.any()),
  source: z
    .object({
      fileName: z.string(),
      lineNumber: z.number(),
      columnNumber: z.number(),
    })
    .optional(),
});

export type RenderedComponentData = z.infer<typeof RenderedComponentDataSchema>;

// ============================================================================
// Content Script → Background Script (Or Just Bridge) Messages
// ============================================================================

const ContentMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SELECT_COMPONENT'),
    data: z.object({
      id: z.string(),
    }),
  }),
  z.object({
    type: z.literal('SET_STATE'),
    data: z.object({
      components: z.array(RenderedComponentDataSchema),
      selectedComponent: RenderedComponentDataSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal('OPEN_SETTINGS_POPUP'),
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

const BackgroundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TOGGLE_FEATURES'),
    data: z.undefined().optional(),
  }),
  z.object({
    type: z.literal('REQUEST_STATE'),
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

const WebSocketMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('SELECT_COMPONENT'),
    data: z.object({
      tabId: z.number(),
      id: z.string(),
    }),
  }),
  z.object({
    type: z.literal('SET_STATE'),
    data: z.object({
      tabId: z.number(),
      components: z.array(RenderedComponentDataSchema),
      selectedComponent: RenderedComponentDataSchema.nullable(),
    }),
  }),
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// ============================================================================
// MCP Server → Background Script (WebSocket)
// ============================================================================

const MCPServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('REQUEST_INITIAL_STATE'),
    data: z.object({
      tabId: z.number(),
    }),
  }),
]);

export type MCPServerMessage = z.infer<typeof MCPServerMessageSchema>;

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

/**
 * Validate and parse MCPServer message
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
