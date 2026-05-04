import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createCodexAnalyzerMiddleware } from "./server/codexAnalyzer";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(webRoot, "../..");

export default defineConfig({
  plugins: [react(), codexAnalyzerPlugin()],
  server: {
    host: true,
    allowedHosts: true
  },
  preview: {
    host: true,
    allowedHosts: true
  }
});

function codexAnalyzerPlugin(): Plugin {
  return {
    name: "agent-factory-codex-analyzer",
    configureServer(server) {
      server.middlewares.use("/api/analyze-requirement", createCodexAnalyzerMiddleware(repoRoot));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/analyze-requirement", createCodexAnalyzerMiddleware(repoRoot));
    }
  };
}
