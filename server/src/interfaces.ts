import { RenderedComponentData } from '@react-mcp/core';

export interface ComponentState extends RenderedComponentData {
  tabId: number | undefined;
}

export interface ComponentError {
  componentName: string;
  message: string;
}

export interface TabState {
  tabId: number;
  components: Map<string, ComponentState>;
  selectedComponentId: string | null;
  lastHandshake: number;
  lastPing: number;
}
