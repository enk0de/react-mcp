export interface ComponentState {
  id: string;
  name: string;
  file: string;
  props: Record<string, any>;
  state: Record<string, any>;
  tabId: number | undefined;
  timestamp: number;
}

export interface ComponentError {
  componentName: string;
  message: string;
  timestamp: number;
}
