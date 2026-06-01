#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const outputRoot = process.argv[2];
const artifactRoot = process.argv[3];

if (!outputRoot) {
  throw new Error("Usage: node scripts/generate-adk-source.test.mjs <generated-output-root>");
}

const packageName = discoverGeneratedPackage(outputRoot);
const manifestPath = join(outputRoot, packageName, "workflow_manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

assert.equal(manifest.guardrails.raw_requirement_to_code, false);
assert.equal(manifest.guardrails.generated_business_logic, false);
assert.equal(manifest.guardrails.private_data_or_endpoints, false);
assert.equal(manifest.scaffold_plan.source, "approved_workbench_artifact");
assert.equal(manifest.scaffold_plan.raw_requirement_to_code, false);
assert.ok(manifest.graph_ir, "workflow_manifest.json must include graph_ir summary");
assert.ok(Array.isArray(manifest.graph_ir.terminal_outputs), "graph_ir.terminal_outputs must be an array");
assert.ok(manifest.graph_ir.terminal_outputs.length > 0, "graph_ir.terminal_outputs must not be empty");
assert.ok(Array.isArray(manifest.edges), "workflow_manifest.json must preserve source Graph IR edges");

const contractTest = readFileSync(join(outputRoot, "tests", "test_workflow_contract.py"), "utf8");
assert.match(contractTest, /"graph_ir"/);
const agentSource = readFileSync(join(outputRoot, packageName, "agent.py"), "utf8");
assert.match(agentSource, /from google\.adk\.agents import BaseAgent/);
assert.match(agentSource, /class SyntheticRuntimeSmokeAgent\(BaseAgent\)/);
assert.match(agentSource, /runtime_mock_smoke/);
assert.match(agentSource, /GRAPH_EDGES = \[/);
assert.match(agentSource, /\("START", "node_/);
assert.doesNotMatch(agentSource, /"\\"START\\""/);
if (packageName === "req_001_adk") {
  assert.match(agentSource, /\("START", "node_mod_001"\)/);
  assert.match(agentSource, /\("node_mod_001", "node_mod_002"\)/);
  assert.match(agentSource, /\("node_mod_002", "emit_workflow_result"\)/);
}
assert.ok(existsSync(join(outputRoot, "scaffold-plan.json")), "generated bundle must carry scaffold-plan.json");
assert.ok(existsSync(join(outputRoot, "implementation-handoff.md")), "generated bundle must carry implementation-handoff.md");
assert.ok(existsSync(join(outputRoot, "runtime-chat-smoke.json")), "generated bundle must carry runtime-chat-smoke.json");

if (artifactRoot) {
  const runManifest = JSON.parse(readFileSync(join(artifactRoot, "af-run-manifest.json"), "utf8"));
  assert.equal(runManifest.current_stage, "build");
  assert.equal(runManifest.stages.build.status, "complete");
  assert.ok(runManifest.stages.build.outputs.includes("runtime-stub/"));
  assert.ok(
    runManifest.validation.commands.some((command) => command.includes("python3 -m compileall")),
    "manifest validation commands must include compileall"
  );
}

function discoverGeneratedPackage(root) {
  const packages = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => existsSync(join(root, entry, "workflow_manifest.json")));
  assert.equal(packages.length, 1, `expected one generated ADK package, found ${packages.join(", ") || "none"}`);
  return packages[0];
}
