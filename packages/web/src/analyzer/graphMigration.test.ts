import assert from "node:assert/strict";
import { mergeGraphIRValidation, normalizeGraphIRForRuntime, validateGraphIRSoft } from "./graphMigration.ts";
import type { GraphEdge, GraphIR, GraphNode } from "./types.ts";

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

function graphWithRemoteEdge(nodes: GraphNode[], edges: GraphEdge[]): GraphIR {
  return {
    requirement_id: "req-remote-link",
    graph_id: "graph-001",
    root_workflow_module_id: null,
    nodes,
    edges,
    containers: [],
    lanes: [],
    validation: {
      ok: true,
      errors: [],
      warnings: [
        {
          code: "remote_link_incoherent",
          message: "stale warning",
          target_kind: "edge",
          target_id: "edge-stale"
        }
      ]
    }
  };
}

function edge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: "edge-001",
    from: "node-input",
    to: "node-output",
    from_port: null,
    to_port: null,
    edge_kind: "remote_a2a",
    execution_semantics: "boundary_crossing",
    data_label: "",
    schema_ref: null,
    route_condition: null,
    state_key: null,
    artifact_key: null,
    a2a_contract_id: "a2a-001",
    is_remote_boundary_crossing: true,
    ...overrides
  };
}

const remoteLinkWithoutRemoteEndpoint = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-input", node_kind: "input", lane_id: "input" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [edge()]
  )
);
const remoteLinkWarnings = remoteLinkWithoutRemoteEndpoint.warnings.filter((issue) => issue.code === "remote_link_incoherent");
assert.equal(remoteLinkWarnings.length, 1);
assert.deepEqual(remoteLinkWarnings[0], {
  code: "remote_link_incoherent",
  message: "Remote edge edge-001 should connect to a remote_a2a node with module_id.",
  target_kind: "edge",
  target_id: "edge-001"
});

const coherentRemoteLink = validateGraphIRSoft(
  graphWithRemoteEdge(
    [
      node({ id: "node-input", node_kind: "input", lane_id: "input" }),
      node({ id: "node-remote", node_kind: "remote_a2a", module_id: "mod-remote", owner_scope: "remote", lane_id: "remote_boundary" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [
      edge({ to: "node-remote" }),
      edge({
        id: "edge-002",
        from: "node-remote",
        to: "node-output",
        edge_kind: "event_output",
        execution_semantics: "normal_transition",
        a2a_contract_id: null,
        is_remote_boundary_crossing: false
      })
    ]
  )
);
assert.equal(coherentRemoteLink.warnings.filter((issue) => issue.code === "remote_link_incoherent").length, 0);

const merged = mergeGraphIRValidation(
  graphWithRemoteEdge(
    [
      node({ id: "node-input", node_kind: "input", lane_id: "input" }),
      node({ id: "node-output", node_kind: "output", lane_id: "output" })
    ],
    [edge()]
  ).validation,
  remoteLinkWithoutRemoteEndpoint
);
assert.equal(merged.warnings.filter((issue) => issue.code === "remote_link_incoherent").length, 1);

const mergedWithoutStaleModuleConnectivityWarnings = mergeGraphIRValidation(
  {
    ok: false,
    errors: [],
    warnings: [
      {
        code: "module_node_missing_incoming",
        message: "stale missing incoming warning",
        target_kind: "node",
        target_id: "node-agent"
      },
      {
        code: "module_node_missing_outgoing",
        message: "stale missing outgoing warning",
        target_kind: "node",
        target_id: "node-agent"
      }
    ]
  },
  { errors: [], warnings: [] }
);
assert.deepEqual(
  mergedWithoutStaleModuleConnectivityWarnings.warnings.map((issue) => issue.code),
  []
);
