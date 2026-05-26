import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createAdkRuntimeMiddleware } from "./server/adkRuntime";
import { createAfArtifactsMiddleware } from "./server/afArtifactsApi";
import { createAfCatalogMiddleware } from "./server/afCatalogApi";
import { createCodexAnalyzerMiddleware } from "./server/codexAnalyzer";
import { createModuleResolutionMiddleware } from "./server/moduleResolution";

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
      server.middlewares.use("/api/resolve-module-candidate", createModuleResolutionMiddleware(repoRoot));
      server.middlewares.use("/api/adk-runtime", createAdkRuntimeMiddleware(repoRoot));
      server.middlewares.use("/api/af", createAfArtifactsMiddleware(repoRoot));
      server.middlewares.use("/api/catalog", createAfCatalogMiddleware(repoRoot));
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/analyze-requirement", createCodexAnalyzerMiddleware(repoRoot));
      server.middlewares.use("/api/resolve-module-candidate", createModuleResolutionMiddleware(repoRoot));
      server.middlewares.use("/api/adk-runtime", createAdkRuntimeMiddleware(repoRoot));
      server.middlewares.use("/api/af", createAfArtifactsMiddleware(repoRoot));
      server.middlewares.use("/api/catalog", createAfCatalogMiddleware(repoRoot));
    }
  };
}
