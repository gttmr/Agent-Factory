import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createAfArtifactsMiddleware } from "./server/afArtifactsApi";
import { createAfCatalogMiddleware } from "./server/afCatalogApi";
import { createAfCollaborationMiddleware } from "./server/afCollaborationApi";
import { createCodexAnalyzerMiddleware } from "./server/codexAnalyzer";
import { createMockLabMiddleware } from "../mock-lab/server/mockLabApi";

const webRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(webRoot, "../..");

export default defineConfig({
  plugins: [react(), agentFactoryServerPlugin()],
  // The /mock-lab route imports MockLabApp from packages/mock-lab/src, which
  // resolves React from packages/mock-lab/node_modules — a different physical
  // copy than packages/web's. Two React instances break hooks at runtime
  // ("Cannot read properties of null (reading 'useState')"). Dedupe to one copy.
  resolve: {
    dedupe: ["react", "react-dom"]
  },
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
      server.middlewares.use("/api/mock-lab", createMockLabMiddleware(repoRoot));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/analyze-requirement", createCodexAnalyzerMiddleware(repoRoot));
      server.middlewares.use("/api/af-collab", createAfCollaborationMiddleware(repoRoot));
      server.middlewares.use("/api/af", createAfArtifactsMiddleware(repoRoot));
      server.middlewares.use("/api/catalog", createAfCatalogMiddleware(repoRoot));
      server.middlewares.use("/api/mock-lab", createMockLabMiddleware(repoRoot));
    }
  };
}
