import assert from "node:assert/strict";
import {
  GRAPH_ELEMENT_GROUPS,
  availableGraphElementGroups,
  isEdgeKindEditable,
  isNodeModuleLinkEditable,
  nextGraphElementGroupAfterSelectionChange
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
  GRAPH_ELEMENT_GROUPS.map((group) => group.id),
  ["summary", "io", "flow", "runtime", "risk", "adk", "raw"],
  "Graph element detail groups follow the contextual information architecture"
);
assert.deepEqual(
  availableGraphElementGroups({
    selectedNode: node({
      node_kind: "adapter_call",
      schema_refs: ["customer.lookup.request.v1", "customer.lookup.response.v1"],
      mock_binding: {
        provider: "mock_lab",
        package_path: "packages/mock-lab",
        mock_server_id: "wf-customer",
        tool_name: "lookup_customer",
        input_schema: "customer.lookup.request.v1",
        output_schema: "customer.lookup.response.v1",
        sample_response_ref: "customer.lookup.basic",
        status: "linked"
      },
      invoke_binding: "mcp_tool",
      call_control: "fixed_by_workflow"
    }),
    selectedEdge: null,
    candidate: null
  }).map((group) => group.id),
  ["summary", "io", "runtime", "raw"],
  "adapter calls show IO and runtime details without irrelevant ADK or flow groups"
);
assert.deepEqual(
  availableGraphElementGroups({
    selectedNode: node({
      node_kind: "adapter_call",
      schema_refs: ["customer.lookup.request.v1"],
      adk_skeleton_contract: {
        scaffold_level: "mock_testable_skeleton",
        implementation_template: "adapter_placeholder_stub",
        manual_completion_required: true,
        developer_todos: ["Wire the MCP adapter."]
      }
    }),
    selectedEdge: null,
    candidate: null
  }).map((group) => group.id),
  ["summary", "io", "raw"],
  "ADK Skeleton is workflow-only even when legacy adapter data carries a skeleton field"
);
assert.deepEqual(
  availableGraphElementGroups({
    selectedNode: node({
      node_kind: "workflow_call",
      workflow_ref: { id: "wf-risk", version: "v1", source: "catalog", display_name: "Risk" },
      input_mapping: { payload: "$state.payload" },
      output_mapping: { result: "$result" },
      adk_skeleton_contract: {
        scaffold_level: "mock_testable_skeleton",
        implementation_template: "workflow_call_placeholder_stub",
        manual_completion_required: true,
        developer_todos: ["Define the subworkflow contract."]
      }
    }),
    selectedEdge: null,
    candidate: null
  }).map((group) => group.id),
  ["summary", "io", "runtime", "adk", "raw"],
  "workflow calls expose mapping, runtime target, and ADK skeleton details"
);
assert.deepEqual(
  availableGraphElementGroups({
    selectedNode: null,
    selectedEdge: edge("router", "analysis", {
      edge_kind: "route",
      execution_semantics: "conditional",
      flow_kind: "route",
      route_condition: "choice == run_analysis",
      route_aliases: ["run", "분석"],
      is_default_route: false
    }),
    candidate: null
  }).map((group) => group.id),
  ["summary", "flow", "raw"],
  "route edges focus on flow details and hide Mock/ADK"
);
assert.equal(
  nextGraphElementGroupAfterSelectionChange(
    "adk",
    availableGraphElementGroups({
      selectedNode: node({ node_kind: "adapter_call", schema_refs: ["customer.lookup.request.v1"] }),
      selectedEdge: null,
      candidate: null
    })
  ),
  "summary",
  "selection changes fall back to summary when the previous group is unavailable"
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

assert.equal(isEdgeKindEditable(edge("router", "target", { edge_kind: "route" })), false);
assert.equal(isEdgeKindEditable(edge("source", "remote", { edge_kind: "remote_a2a" })), false);
assert.equal(isEdgeKindEditable(edge("source", "target", { edge_kind: "event_output" })), true);
