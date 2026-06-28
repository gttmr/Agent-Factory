#!/usr/bin/env node

import { join, resolve } from "node:path";
import { writeBundleFiles } from "./adk-source/bundle-writer.mjs";
import { loadArtifactContext } from "./adk-source/context.mjs";
import { buildFiles } from "./adk-source/file-builder.mjs";
import { updateRunManifest } from "./adk-source/run-manifest.mjs";

const artifactRoot = resolve(process.argv[2] ?? "templates");
const outputRoot = resolve(process.argv[3] ?? "generated/adk-source");
const artifactContext = loadArtifactContext(artifactRoot);
const { runManifest, outputMode, packageName } = artifactContext;
const files = buildFiles({ artifactRoot, outputRoot, ...artifactContext });

writeBundleFiles(outputRoot, files);
updateRunManifest({ artifactRoot, outputRoot, packageName, runManifest });

console.log(`ADK source generated from scaffold-plan.json (output_mode=${outputMode}): ${join(outputRoot, packageName)}`);
console.log("Prepare the shared ADK runtime from the repository root:");
console.log("  python3 -m venv .agent-factory/runtime/.venv");
console.log("  .agent-factory/runtime/.venv/bin/python -m pip install -r requirements/adk-runtime.txt");
if (outputMode === "runnable") {
  console.log("  # .env.example을 <repo>/.agent-factory/runtime.env로 복사하고 AF_VLLM_* 또는 GOOGLE_API_KEY를 설정하세요");
}
console.log(`Run checks from ${outputRoot}:`);
console.log(`  python -m compileall ${packageName}`);
console.log("  python -m pytest -q");
