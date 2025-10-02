import { z } from "zod";

/**
 * Message schemas for MCP server WebSocket communication
 */

// ============================================================================
// Shared Data Schemas
// ============================================================================

const RenderedComponentDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  file: z.string(),
  props: z.record(z.string(), z.any()),
  state: z.record(z.string(), z.any()),
});

const ReactErrorDataSchema = z.object({
  message: z.string(),
  componentName: z.string().optional(),
  source: z.enum(["console", "fiber"]),
});

export type RenderedComponentData = z.infer<typeof RenderedComponentDataSchema>;
export type ReactErrorData = z.infer<typeof ReactErrorDataSchema>;

// ============================================================================
// Browser Extension → MCP Server Messages (WebSocket)
// ============================================================================

const WebSocketMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("HANDSHAKE"),
    data: z.object({
      tabId: z.number(),
      components: z.array(RenderedComponentDataSchema),
      errors: z.array(ReactErrorDataSchema),
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
  z.object({
    type: z.literal("ERROR"),
    data: ReactErrorDataSchema.extend({
      tabId: z.number(),
    }),
  }),
]);

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

/**
 * Validate and parse WebSocket message from browser extension
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

export function isWebSocketMessage(data: unknown): data is WebSocketMessage {
  return WebSocketMessageSchema.safeParse(data).success;
}
