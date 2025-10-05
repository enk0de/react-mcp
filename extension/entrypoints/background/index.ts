import {
  BackgroundMessage,
  ContentMessage,
  MCPServerMessage,
} from '@react-mcp/core';
import { onMessage, sendMessage } from '../../libs/messaging';
import { PortStorage } from '../../libs/storage/port';
import { SocketConnection } from './socket';

export default defineBackground({
  main() {
    const background = new Background();
    background.init();
  },
});

class Background {
  private port: PortStorage;
  private connection: SocketConnection;

  constructor() {
    this.port = new PortStorage();
    this.connection = new SocketConnection(this.port, {
      onMessage: this.handleServerMessage.bind(this),
    });
  }

  init() {
    console.log('[React MCP Background] Initialize');
    this.connection.start();

    onMessage('contentToBackground', ({ data, sender }) => {
      console.log('[React MCP Background] Received message:', data);
      this.handleContentMessage(data, sender);
    });
  }

  dispose() {
    this.connection.dispose();
  }

  private handleContentMessage(
    message: ContentMessage,
    sender: chrome.runtime.MessageSender,
  ) {
    const tabId = sender.tab?.id;

    if (tabId == null) {
      console.error(
        '[React MCP Background] Cannot handle message, missing tab ID',
        message,
        sender,
      );
      return;
    }

    switch (message.type) {
      case 'OPEN_SETTINGS_POPUP':
        chrome.action.openPopup().catch((error) => {
          console.error('[React MCP Background] Failed to open popup:', error);
        });
        return;

      case 'SELECT_COMPONENT':
        this.connection.sendMessage({
          type: message.type,
          data: {
            tabId,
            ...message.data,
          },
        });
        return;

      case 'SET_STATE':
        console.log('set state');
        this.connection.sendMessage({
          type: message.type,
          data: {
            tabId,
            ...message.data,
          },
        });
        return;
    }
  }

  private handleServerMessage(message: MCPServerMessage) {
    switch (message.type) {
      case 'REQUEST_INITIAL_STATE':
        this.sendMessageToContentScript(message.data.tabId, {
          type: 'REQUEST_STATE',
        });
    }
  }

  private sendMessageToContentScript(
    tabId: number,
    message: BackgroundMessage,
  ) {
    sendMessage('backgroundToContent', message, { tabId }).catch((error) => {
      console.error(
        '[React MCP Background] Failed to send message to content script:',
        error,
      );
    });
  }
}
