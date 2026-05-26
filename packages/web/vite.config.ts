import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createAfArtifactsMiddleware } from "./server/afArtifactsApi";
import { createAfCatalogMiddleware } from "./server/afCatalogApi";
import { createAfCollaborationMiddleware } from "./server/afCollaborationApi";
import { createCodexAnalyzerMiddleware } from "./server/codexAnalyzer";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(webRoot, "../..");

export default defineConfig({
  plugins: [react(), agentFactoryServerPlugin()],
  server: {
    host: true,
    allowedHosts: true
  },
  preview: {
    host: true,
    allowedHosts: true
  }
});

function agentFactoryServerPlugin(): Plugin {
  return {
    name: "agent-factory-server",
    configureServer(server) {
      server.middlewares.use("/api/analyze-requirement", createCodexAnalyzerMiddleware(repoRoot));
      server.middlewares.use("/api/af-collab", createAfCollaborationMiddleware(repoRoot));
      server.middlewares.use("/api/af", createAfArtifactsMiddleware(repoRoot));
      server.middlewares.use("/api/catalog", createAfCatalogMiddleware(repoRoot));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/analyze-requirement", createCodexAnalyzerMiddleware(repoRoot));
      server.middlewares.use("/api/af-collab", createAfCollaborationMiddleware(repoRoot));
      server.middlewares.use("/api/af", createAfArtifactsMiddleware(repoRoot));
      server.middlewares.use("/api/catalog", createAfCatalogMiddleware(repoRoot));
    }
  };
}
