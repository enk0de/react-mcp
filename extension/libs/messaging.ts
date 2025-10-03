import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  BackgroundMessage,
  ContentMessage,
} from "@react-mcp/core";

interface ProtocolMap {
  // Content Script → Background
  contentToBackground(message: ContentMessage): void;

  // Background → Content Script (ISOLATED world)
  backgroundToContent(message: BackgroundMessage): void;
}

export const { sendMessage, onMessage } =
  defineExtensionMessaging<ProtocolMap>();
