import { DEFAULT_PORT } from "@react-mcp/core";

export function parsePort(): number {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) {
      const parsedPort = parseInt(args[i + 1], 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        return parsedPort;
      } else {
        console.error(`Invalid port: ${args[i + 1]}`);
        process.exit(1);
      }
    }
  }

  return DEFAULT_PORT;
}
