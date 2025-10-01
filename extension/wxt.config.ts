import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "React MCP",
    description: "MCP integration for React development",
    permissions: ["activeTab"],
    host_permissions: ["http://localhost/*", "http://127.0.0.1/*"],
    action: {
      default_title: "React MCP",
    },
  },
  outDir: "dist",
  webExt: {
    startUrls: ["http://localhost:5173"],
  },
});
