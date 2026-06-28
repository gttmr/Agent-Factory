import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("validate-artifacts rejects invalid reviewed route defaults and aliases", () => {
  const artifactRoot = tempArtifactRoot("af-validator-route-contract-");
  const analysis = readScenarioAnalysis();
  analysis.processFlow = processFlowWithReviewedRoutes({
    edges: [
      routeEdge("edge-001", "node-a", {
        route_condition: "choice == a",
        route_aliases: ["", "run"],
        is_default_route: true
      }),
      routeEdge("edge-002", "node-b", {
        route_condition: "choice == b",
        is_default_route: true
      }),
      graphEdge("edge-003", "node-a", "node-b", {
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        route_aliases: ["not allowed"]
      })
    ]
  });

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /route_aliases entries must be non-empty strings/);
  assert.match(result.stderr, /route_aliases is allowed only on route edges/);
  assert.match(result.stderr, /router .* has multiple default route edges/);
});

test("validate-artifacts rejects human input contracts without reviewed message", () => {
  const artifactRoot = tempArtifactRoot("af-validator-human-input-contract-");
  const analysis = readScenarioAnalysis();
  analysis.processFlow = processFlowWithReviewedRoutes({
    nodes: [
      graphNode("node-input", "input", "input"),
      graphNode("node-human", "human_input", "human_input", {
        human_input_contract: {
          message: " ",
          payload_schema_ref: null,
          response_schema_ref: "AddressForm",
          response_mapping: null
        }
      }),
      graphNode("node-output", "output", "output")
    ],
    edges: [
      graphEdge("edge-001", "node-input", "node-human"),
      graphEdge("edge-002", "node-human", "node-output")
    ]
  });

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /human_input_contract\.message must be a non-empty reviewed prompt/);
  assert.match(result.stderr, /response_schema_ref .* runnable currently supports only null or "str"/);
});

test("validate-artifacts rejects malformed human input contract shape", () => {
  const artifactRoot = tempArtifactRoot("af-validator-human-input-contract-shape-");
  const analysis = readScenarioAnalysis();
  analysis.processFlow = processFlowWithReviewedRoutes({
    nodes: [
      graphNode("node-input", "input", "input"),
      graphNode("node-human", "human_input", "human_input", {
        human_input_contract: {
          message: "담당자 승인 여부를 입력하세요.",
          payload_schema_ref: { schema: "AddressForm" },
          response_schema_ref: null,
          response_mapping: []
        }
      }),
      graphNode("node-output", "output", "output")
    ],
    edges: [
      graphEdge("edge-001", "node-input", "node-human"),
      graphEdge("edge-002", "node-human", "node-output")
    ]
  });

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  const result = runValidatorExpectingFailure(artifactRoot);
  assert.match(result.stderr, /human_input_contract\.payload_schema_ref must be a non-empty string or null/);
  assert.match(result.stderr, /human_input_contract\.response_mapping must be an object with non-empty string values or null/);
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
  return mkdtempSync(join(tmpdir(), prefix));
}

function readScenarioAnalysis() {
  return readJson(join(scenarioRoot, "analysis-result.json"));
}

function processFlowWithReviewedRoutes({ nodes = null, edges }) {
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

function graphNode(id, nodeKind, laneId, patch = {}) {
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

function graphEdge(id, from, to, patch = {}) {
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

function routeEdge(id, to, patch = {}) {
  return graphEdge(id, "node-router", to, {
    edge_kind: "route",
    execution_semantics: "conditional",
    ...patch
  });
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
