import { WebSocketServer } from "ws";
import { isPortInUse, killByPort } from "./utils/process.js";

export async function createWebSocketServer({ port }: { port: number }) {
  killByPort(port);

  while (await isPortInUse(port)) {
    console.error(
      `[MCP Server] Port ${port} is already in use. Retrying in 0.1 second...`
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return new WebSocketServer({ port });
}
