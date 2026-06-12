import assert from "node:assert/strict";
import { normalizeGraphIRForRuntime, validateGraphIRSoft } from "./graphMigration.ts";
import type { GraphIR, GraphNode } from "./types.ts";

const graph: GraphIR = {
  requirement_id: "req-position",
  graph_id: "graph-001",
  root_workflow_module_id: null,
  nodes: [
    {
      id: "node-input",
      label: "Input",
      module_id: null,
      node_kind: "input",
      execution_kind: null,
      adk_node_role: null,
      owner_scope: "local",
      container_id: null,
      lane_id: "input",
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: "n/a",
      position: { x: 123, y: 456 }
    },
    {
      id: "node-output",
      label: "Output",
      module_id: null,
      node_kind: "output",
      execution_kind: null,
      adk_node_role: null,
      owner_scope: "local",
      container_id: null,
      lane_id: "output",
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: "n/a",
      position: null
    }
  ],
  edges: [],
  containers: [],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

const normalized = normalizeGraphIRForRuntime(graph, "req-position");

assert.deepEqual(normalized.nodes[0]?.position, { x: 123, y: 456 });
assert.equal(normalized.nodes[1]?.position, null);

function graphWithNodes(nodes: GraphNode[]): GraphIR {
  return {
    requirement_id: "req-module-gate",
    graph_id: "graph-001",
    root_workflow_module_id: null,
    nodes,
    edges: [],
    containers: [],
    lanes: [],
    validation: { ok: true, errors: [], warnings: [] }
  };
}

function node(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "node-agent",
    label: "Agent",
    module_id: null,
    node_kind: "agent",
    execution_kind: null,
    adk_node_role: null,
    owner_scope: "local",
    container_id: null,
    lane_id: "local_graph",
    input_ports: [],
    output_ports: [],
    schema_refs: [],
    review_status: "n/a",
    ...overrides
  };
}

const missingModule = validateGraphIRSoft(graphWithNodes([node()]));
const missingModuleErrors = missingModule.errors.filter((issue) => issue.code === "node_missing_module_id");
assert.equal(missingModuleErrors.length, 1);
assert.deepEqual(missingModuleErrors[0], {
  code: "node_missing_module_id",
  message: "Node node-agent (agent) requires a module_id.",
  target_kind: "node",
  target_id: "node-agent"
});

const lenientKinds: GraphNode["node_kind"][] = ["input", "output", "function", "tool", "human_input"];
const lenientResult = validateGraphIRSoft(
  graphWithNodes(
    lenientKinds.map((nodeKind) =>
      node({
        id: `node-${nodeKind}`,
        label: nodeKind,
        node_kind: nodeKind,
        lane_id: nodeKind === "input" ? "input" : nodeKind === "output" ? "output" : "local_graph"
      })
    )
  )
);
assert.equal(lenientResult.errors.filter((issue) => issue.code === "node_missing_module_id").length, 0);

const linkedModule = validateGraphIRSoft(graphWithNodes([node({ module_id: "mod-agent" })]));
assert.equal(linkedModule.errors.filter((issue) => issue.code === "node_missing_module_id").length, 0);
