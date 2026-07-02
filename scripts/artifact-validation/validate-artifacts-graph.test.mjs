import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  graphEdge,
  graphNode,
  processFlowWithReviewedRoutes,
  readJson,
  readScenarioAnalysis,
  remoteScenarioRoot,
  routeEdge,
  runValidatorExpectingFailure,
  scenarioRoot,
  tempArtifactRoot,
  validator,
  writeJson
} from "./validate-artifacts-test-utils.mjs";

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
  assert.match(result.stderr, /route_aliases is allowed only on route or loop decision edges/);
  assert.match(result.stderr, /router .* has multiple default route edges/);
});

test("validate-artifacts accepts reviewed loop decision aliases and defaults", () => {
  const artifactRoot = tempArtifactRoot("af-validator-loop-route-contract-");
  const analysis = readScenarioAnalysis();
  analysis.processFlow = processFlowWithReviewedRoutes({
    nodes: [
      graphNode("node-input", "input", "input"),
      graphNode("node-body", "router", "local_graph"),
      graphNode("node-loop", "loop_control", "local_graph"),
      graphNode("node-output", "output", "output")
    ],
    edges: [
      graphEdge("edge-001", "node-input", "node-body"),
      graphEdge("edge-002", "node-body", "node-loop"),
      graphEdge("edge-003", "node-loop", "node-body", {
        edge_kind: "control",
        execution_semantics: "loop_back",
        route_condition: "decision == retry",
        route_aliases: ["retry", "revise"]
      }),
      graphEdge("edge-004", "node-loop", "node-output", {
        edge_kind: "control",
        execution_semantics: "loop_exit",
        route_condition: "decision == done",
        route_aliases: ["approved"],
        is_default_route: true
      })
    ]
  });

  writeJson(join(artifactRoot, "analysis-result.json"), analysis);

  execFileSync(process.execPath, [validator, artifactRoot], { encoding: "utf8", stdio: "pipe" });
  rmSync(artifactRoot, { recursive: true, force: true });
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
