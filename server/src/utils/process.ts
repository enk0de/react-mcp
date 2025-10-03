import { execSync } from "node:child_process";
import net from "node:net";
import { exit } from "node:process";

export function killByPort(port: number) {
  try {
    if (process.platform === "win32") {
      execSync(
        `FOR /F "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a`
      );
    }

    execSync(`lsof -i :${port} -t | xargs kill -9`);
  } catch (error) {
    console.error(
      `[Process] No process found on port ${port} or failed to kill:`,
      error
    );
    exit(1);
  }
}

export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(port);
  });
}
