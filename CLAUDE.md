# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

react-mcp is an MCP (Model Context Protocol) server integrated with a browser extension that helps developers work with React applications. It allows LLMs like Claude to interact with React components directly from the browser.

## Architecture

The project consists of two main components:

1. **Browser Extension** (`extension/`): Chrome/Firefox extension that injects into React dev environments

   - Parses React component tree using React DevTools hooks
   - Detects component errors and warnings
   - Displays UI overlays on error components
   - Communicates with MCP Server via WebSocket

2. **MCP Server** (`mcp-server/`): Dual-protocol server
   - **WebSocket API**: Real-time bidirectional communication with browser extension
     - Receives messages: `REACT_DETECTED`, `COMPONENT_CLICKED`, `REACT_ERROR`
     - Sends acknowledgments and responses
     - Auto-reconnection support
   - **MCP Protocol** (stdio): Exposes tools to Claude Desktop
     - `list_components` - List all detected React components
     - `get_component_details` - Get detailed component information
     - `list_errors` - List all React errors
     - `analyze_component` - Analyze component and provide suggestions

### Communication Flow

```
Browser (React App)
  → Extension (Content Script detects React, errors)
  → Extension (Background Script)
  → WebSocket (MCP Server)
  → MCP Tools
  → Claude Desktop (stdio)
```

## Coding Principles

### Comments

- Write comments only for core logic and complex algorithms
- Avoid excessive or unnecessary comments
- Let the code be self-documenting where possible

## Package Manager

This project uses **pnpm** (v10.16.1). Always use `pnpm` commands.

## Development Commands

### Building

- `pnpm build` - Build all packages
- `pnpm build:extension` - Build browser extension only (production build with WXT)
- `pnpm build:mcp` - Build MCP server only

### Running

- `pnpm start:mcp` - Start MCP server (WebSocket, MCP on stdio)
- `pnpm dev:extension` - Start WXT dev server with hot reload (opens browser automatically)
- `pnpm dev:mcp` - Watch and rebuild MCP server on changes

### Extension Development (WXT)

The extension uses WXT (Web Extension Tools) for modern development experience:

- Hot module reload in development mode
- TypeScript support out of the box
- Automatic manifest generation
- Multi-browser support (Chrome, Firefox, etc.)

### Testing

- `pnpm test` - Run all tests

## Installation & Setup

1. Install dependencies: `pnpm install`
2. Build all components: `pnpm build`
3. Start MCP server: `pnpm start:mcp`
4. Load extension in browser:
   - **Development**: Run `pnpm dev:extension` (WXT will auto-open browser with extension loaded)
   - **Production**:
     - Chrome: Go to `chrome://extensions`
     - Enable "Developer mode"
     - Click "Load unpacked"
     - Select `extension/dist/chrome-mv3` directory
5. Configure MCP server in Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
   ```json
   {
     "mcpServers": {
       "react-mcp": {
         "command": "node",
         "args": ["/absolute/path/to/react-mcp/mcp-server/dist/index.js"]
       }
     }
   }
   ```

## Usage

### Quick Start with Test App

1. Start the MCP server: `pnpm start:mcp`
2. Start the test React app: `pnpm dev:test-app` (runs on http://localhost:5173)
3. Start the extension: `pnpm dev:extension` (will auto-open browser with test app)
4. The extension will automatically detect React and send component data to the MCP server

### Using with Your Own React App

1. Start the MCP server: `pnpm start:mcp`
2. Open your React application in Chrome
3. The extension will automatically detect React and send component data to the MCP server

### Features

- In Claude Desktop, you can now use MCP tools:
  - "List all React components detected in the browser"
  - "Show me details of component X"
  - "What errors occurred in the React app?"
- To manually inspect a component, hold **Alt/Option** and click on any element in the browser
- Test app includes interactive components and error testing button

## Test App

The `test-app/` directory contains a sample React application for testing the extension:

- **Counter**: Simple state management example
- **User Cards**: Multiple component instances
- **Error Testing**: Button to trigger React errors and test error detection
- **Instructions**: Built-in guide for using the extension
