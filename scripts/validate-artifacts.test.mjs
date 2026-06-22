import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(repoRoot, "scripts", "validate-artifacts.mjs");
const scenarioRoot = join(repoRoot, "templates", "regression-scenarios", "scenario-j-workflow-call-mock-lab");
const remoteScenarioRoot = join(repoRoot, "templates", "regression-scenarios", "scenario-i-remote-a2a");

test("validate-artifacts rejects module-bound human input graph semantics", () => {
  const artifactRoot = tempArtifactRoot("af-validator-human-");
  const analysis = readScenarioAnalysis();
  const target = analysis.processFlow.nodes.find((node) => node.id === "node-customer-profile");
  assert.ok(target);
  target.node_kind = "human_input";
  target.lane_id = "human_input";

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /synthetic nodes must have module_id null|must not bind/i);
});

test("validate-artifacts rejects module-bound callback wait graph semantics", () => {
  const artifactRoot = tempArtifactRoot("af-validator-callback-");
  const analysis = readScenarioAnalysis();
  const target = analysis.processFlow.nodes.find((node) => node.id === "node-customer-profile");
  assert.ok(target);
  target.node_kind = "callback_wait";
  target.lane_id = "local_graph";
  target.invoke_binding = "callback_wait";
  target.decision_owner = "workflow_code";
  target.call_control = "event_callback";
  analysis.processFlow.edges[0].flow_kind = "callback";

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /synthetic nodes must have module_id null|must not bind/i);
});

test("validate-artifacts rejects invalid scaffold graph metadata", () => {
  const artifactRoot = tempArtifactRoot("af-validator-scaffold-");
  const plan = readJson(join(scenarioRoot, "scaffold-plan.json"));
  plan.graph.nodes[1].invoke_binding = "mcp";
  plan.graph.edges[0].flow_kind = "then";

  writeJson(join(artifactRoot, "scaffold-plan.json"), plan);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /scaffold\.graph\.nodes\[1\]\.invoke_binding/);
  assert.match(result.stderr, /scaffold\.graph\.edges\[0\]\.flow_kind/);
});

test("validate-artifacts rejects invalid scaffold package_name", () => {
  const artifactRoot = tempArtifactRoot("af-validator-package-name-");
  const plan = readJson(join(scenarioRoot, "scaffold-plan.json"));
  plan.package_name = "wf-page-recommendation-required";

  writeJson(join(artifactRoot, "scaffold-plan.json"), plan);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /scaffold plan package_name/);
});

test("validate-artifacts rejects adapter_call carrying LLM-selected toolset semantics (scaffold graph)", () => {
  const artifactRoot = tempArtifactRoot("af-validator-toolset-scaffold-");
  const plan = readJson(join(scenarioRoot, "scaffold-plan.json"));
  // node[1] is the adapter_call node; LLM-selected MCP toolset belongs on an agent.
  plan.graph.nodes[1].invoke_binding = "mcp_toolset";
  plan.graph.nodes[1].call_control = "selected_by_llm";

  writeJson(join(artifactRoot, "scaffold-plan.json"), plan);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /mcp_toolset \/ selected_by_llm belong on an agent decision node/);
});

test("validate-artifacts rejects adapter_call carrying LLM-selected toolset semantics (analysis graph)", () => {
  const artifactRoot = tempArtifactRoot("af-validator-toolset-analysis-");
  const analysis = readScenarioAnalysis();
  const target = analysis.processFlow.nodes.find((node) => node.node_kind === "adapter_call");
  assert.ok(target);
  target.invoke_binding = "mcp_toolset";
  target.call_control = "selected_by_llm";

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /mcp_toolset \/ selected_by_llm belong on an agent decision node/);
});

test("validate-artifacts rejects edge call_control selected_by_llm (scaffold graph)", () => {
  const artifactRoot = tempArtifactRoot("af-validator-edge-toolset-scaffold-");
  const plan = readJson(join(scenarioRoot, "scaffold-plan.json"));
  plan.graph.edges[0].call_control = "selected_by_llm";

  writeJson(join(artifactRoot, "scaffold-plan.json"), plan);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /call_control selected_by_llm; LLM-selected toolset selection is agent node metadata/);
});

test("validate-artifacts rejects edge call_control selected_by_llm (analysis graph)", () => {
  const artifactRoot = tempArtifactRoot("af-validator-edge-toolset-analysis-");
  const analysis = readScenarioAnalysis();
  assert.ok(analysis.processFlow.edges.length > 0);
  analysis.processFlow.edges[0].call_control = "selected_by_llm";

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /call_control selected_by_llm; LLM-selected toolset selection is agent node metadata/);
});

test("validate-artifacts accepts remote_agent_call as a Remote A2A graph endpoint", () => {
  const artifactRoot = tempArtifactRoot("af-validator-remote-agent-call-");
  const analysis = readJson(join(remoteScenarioRoot, "analysis-result.json"));
  const remoteNode = analysis.processFlow.nodes.find((node) => node.node_kind === "remote_a2a");
  assert.ok(remoteNode);
  remoteNode.node_kind = "remote_agent_call";

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const output = execFileSync(process.execPath, [validator, artifactRoot], { encoding: "utf8", stdio: "pipe" });
  rmSync(artifactRoot, { recursive: true, force: true });
  assert.match(output, /Artifact validation OK/);
});

function tempArtifactRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(root, { recursive: true });
  return root;
}

function readScenarioAnalysis() {
  return readJson(join(scenarioRoot, "analysis-result.json"));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function runValidatorExpectingFailure(artifactRoot) {
  try {
    execFileSync(process.execPath, [validator, artifactRoot], { encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    rmSync(artifactRoot, { recursive: true, force: true });
    return {
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? "")
    };
  }
  rmSync(artifactRoot, { recursive: true, force: true });
  assert.fail("validate-artifacts unexpectedly succeeded");
}
