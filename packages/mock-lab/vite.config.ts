import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createMockLabMiddleware } from "./server/mockLabApi";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(packageRoot, "../..");

export default defineConfig({
  plugins: [react(), mockLabServerPlugin()],
  server: {
    host: true,
    allowedHosts: true
  },
  preview: {
    host: true,
    allowedHosts: true
  }
});

function mockLabServerPlugin(): Plugin {
  return {
    name: "agent-factory-mock-lab-server",
    configureServer(server) {
      server.middlewares.use("/api/mock-lab", createMockLabMiddleware(repoRoot));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/mock-lab", createMockLabMiddleware(repoRoot));
    }
  };
}
