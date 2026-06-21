import assert from "node:assert/strict";
import {
  GRAPH_ELEMENT_TABS,
  isEdgeKindEditable,
  isNodeModuleLinkEditable,
  isNodeRuntimeControlEditable,
  nextGraphElementTabAfterSelectionChange
} from "./graphElementEditorModel.ts";
import type { GraphEdge, GraphNode } from "../analyzer/types";

function node(patch: Partial<GraphNode>): GraphNode {
  return {
    id: "node-1",
    label: "Node",
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
    ...patch
  };
}

function edge(from = "node-1", to = "node-2", patch: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: "edge-1",
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

assert.deepEqual(
  GRAPH_ELEMENT_TABS.map((tab) => tab.id),
  ["basic", "contract", "runtime", "policy", "mock", "adk"],
  "Graph element editor keeps the approved six-tab order"
);
assert.equal(
  nextGraphElementTabAfterSelectionChange("contract"),
  "contract",
  "graph element tab should stay on the current tab when another node or edge is selected"
);
assert.equal(
  nextGraphElementTabAfterSelectionChange("adk"),
  "adk",
  "graph element tab should preserve the current ADK tab across selection changes"
);

assert.equal(
  isNodeModuleLinkEditable(node({ node_kind: "adapter_call" }), []),
  true,
  "new module-bound adapter nodes may link a module before graph wiring"
);
assert.equal(
  isNodeModuleLinkEditable(node({ node_kind: "adapter_call" }), [edge("node-1", "node-2")]),
  false,
  "wired nodes lock module linkage"
);
assert.equal(
  isNodeModuleLinkEditable(node({ node_kind: "workflow_call", workflow_ref: { id: "wf-risk", version: "v1", source: "catalog", display_name: "Risk" } }), []),
  false,
  "workflow_call nodes with a target contract lock module linkage"
);

assert.equal(isNodeRuntimeControlEditable(node({ node_kind: "agent" })), false);
assert.equal(isNodeRuntimeControlEditable(node({ node_kind: "adapter_call" })), false);
assert.equal(isNodeRuntimeControlEditable(node({ node_kind: "input" })), false);

assert.equal(isEdgeKindEditable(edge("router", "target", { edge_kind: "route" })), false);
assert.equal(isEdgeKindEditable(edge("source", "remote", { edge_kind: "remote_a2a" })), false);
assert.equal(isEdgeKindEditable(edge("source", "target", { edge_kind: "event_output" })), true);

console.log("graphElementEditorModel tests passed");
