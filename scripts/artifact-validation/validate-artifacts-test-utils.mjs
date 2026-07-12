import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const validator = join(repoRoot, "scripts", "validate-artifacts.mjs");
export const scenarioRoot = join(repoRoot, "templates", "regression-scenarios", "scenario-j-workflow-call-mock-lab");
export const remoteScenarioRoot = join(repoRoot, "templates", "regression-scenarios", "scenario-i-remote-a2a");
export const savedFixturesRoot = join(repoRoot, "templates", "saved-analysis-fixtures");

export function tempArtifactRoot(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function readScenarioAnalysis() {
  return readJson(join(scenarioRoot, "analysis-result.json"));
}

export function processFlowWithReviewedRoutes({ nodes = null, edges }) {
  return {
    requirement_id: "req-reviewed-route-contract",
    graph_id: "graph-001",
    root_workflow_module_id: null,
    nodes:
      nodes ?? [
        graphNode("node-input", "input", "input"),
        graphNode("node-router", "router", "local_graph"),
        graphNode("node-a", "output", "output"),
        graphNode("node-b", "output", "output")
      ],
    edges: nodes ? edges : [graphEdge("edge-000", "node-input", "node-router"), ...edges],
    containers: [],
    lanes: [
      { id: "input", label: "input" },
      { id: "human_input", label: "human_input" },
      { id: "local_graph", label: "local_graph" },
      { id: "output", label: "output" }
    ],
    validation: { ok: true, errors: [], warnings: [] }
  };
}

export function graphNode(id, nodeKind, laneId, patch = {}) {
  return {
    id,
    label: id,
    module_id: null,
    node_kind: nodeKind,
    execution_kind: null,
    adk_node_role: null,
    owner_scope: "local",
    container_id: null,
    lane_id: laneId,
    input_ports: [],
    output_ports: [],
    schema_refs: [],
    review_status: "n/a",
    ...patch
  };
}

export function graphEdge(id, from, to, patch = {}) {
  return {
    id,
    from,
    to,
    from_port: null,
    to_port: null,
    edge_kind: "event_output",
    execution_semantics: "normal_transition",
    data_label: "",
    schema_ref: null,
    route_condition: null,
    state_key: null,
    artifact_key: null,
    a2a_contract_id: null,
    is_remote_boundary_crossing: false,
    ...patch
  };
}

export function routeEdge(id, to, patch = {}) {
  return graphEdge(id, "node-router", to, {
    edge_kind: "route",
    execution_semantics: "conditional",
    ...patch
  });
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function runValidatorExpectingFailure(artifactRoot) {
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

export function registrySelectorArtifacts() {
  const analysis = readScenarioAnalysis();
  const plan = readJson(join(scenarioRoot, "scaffold-plan.json"));
  const contract = {
    scaffold_level: "mock_testable_skeleton",
    target_runtime: "adk_python_2_x",
    generation_mode: "deterministic_template",
    implementation_template: "remote_a2a_registry_projection_stub",
    manual_completion_required: true,
    developer_todos: ["review Remote A2A provider projection"]
  };
  const candidate = analysis.moduleCandidates.find((item) => item.id === "mod-customer-profile");
  const node = analysis.processFlow.nodes.find((item) => item.module_id === candidate.id);
  const module = plan.modules.find((item) => item.id === candidate.id);
  assert.ok(candidate && node && module);
  Object.assign(node, {
    runtime_binding: "local_function",
    invoke_binding: "local_function",
    call_control: "fixed_by_workflow",
    adk_skeleton_contract: structuredClone(contract)
  });
  delete node.mock_binding;
  Object.assign(module, {
    access_protocol: "local",
    mcp_server: null,
    mcp_tool_name: null,
    runtime_binding: "local_function",
    invoke_binding: "local_function",
    mock_binding: null,
    adk_skeleton_contract: structuredClone(contract)
  });
  return { analysis, plan, candidate, node, module };
}

export function writeRegistrySelectorArtifacts(artifactRoot, artifacts) {
  writeJson(join(artifactRoot, "analysis-result.json"), artifacts.analysis);
  writeJson(join(artifactRoot, "scaffold-plan.json"), artifacts.plan);
}
