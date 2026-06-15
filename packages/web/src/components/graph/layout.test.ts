import assert from "node:assert/strict";
import { freezeGraphLayout, layoutGraphIR } from "./layout.ts";
import type { GraphIR, GraphNode } from "../../analyzer/types.ts";

const graph: GraphIR = {
  requirement_id: "req-layout-position",
  graph_id: "graph-001",
  root_workflow_module_id: null,
  nodes: [
    {
      id: "node-fixed",
      label: "Fixed",
      module_id: null,
      node_kind: "input",
      execution_kind: null,
      adk_node_role: null,
      owner_scope: "local",
      container_id: "container-root",
      lane_id: "input",
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: "n/a",
      position: { x: 480, y: 320 }
    },
    {
      id: "node-auto",
      label: "Auto",
      module_id: null,
      node_kind: "output",
      execution_kind: null,
      adk_node_role: null,
      owner_scope: "local",
      container_id: "container-root",
      lane_id: "output",
      input_ports: [],
      output_ports: [],
      schema_refs: [],
      review_status: "n/a"
    }
  ],
  edges: [
    {
      id: "edge-1",
      from: "node-fixed",
      to: "node-auto",
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
      is_remote_boundary_crossing: false
    }
  ],
  containers: [
    {
      id: "container-root",
      module_id: null,
      label: "Root",
      container_kind: "graph_workflow",
      adk_mapping: null,
      contains_node_ids: ["node-fixed", "node-auto"],
      entry_node_ids: ["node-fixed"],
      exit_node_ids: ["node-auto"],
      layout_policy: "dag_with_routes",
      parent_container_id: null
    }
  ],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

const layout = layoutGraphIR(graph, { nodeId: null, edgeId: null }, () => undefined);
const fixed = layout.nodes.find((node) => node.id === "node-fixed");
const auto = layout.nodes.find((node) => node.id === "node-auto");

assert.deepEqual(fixed?.position, { x: 480, y: 320 });
assert.ok(auto, "node without persisted position should still be laid out");
assert.notDeepEqual(auto?.position, { x: 0, y: 0 });

const rootRect = layout.containerRects.find((rect) => rect.container.id === "container-root");
assert.ok(rootRect, "container rect should be derived from final node positions");
assert.ok(rootRect.x <= 480, "container should include persisted x coordinate");
assert.ok(rootRect.y <= 320, "container should include persisted y coordinate");

// --- freezeGraphLayout: dragging one node must not move the others ---
// Regression for the edit-mode bug where moving a node re-ran dagre on the rest
// (mixed finite/auto positions) and shifted nodes to its right.
function flowNode(id: string, lane: GraphNode["lane_id"], kind: GraphNode["node_kind"]): GraphNode {
  return {
    id,
    label: id,
    module_id: null,
    node_kind: kind,
    execution_kind: null,
    adk_node_role: null,
    owner_scope: "local",
    container_id: "container-root",
    lane_id: lane,
    input_ports: [],
    output_ports: [],
    schema_refs: [],
    review_status: "n/a"
  };
}

const flowGraph: GraphIR = {
  requirement_id: "req-freeze",
  graph_id: "graph-freeze",
  root_workflow_module_id: null,
  nodes: [flowNode("left", "input", "input"), flowNode("mid", "local_graph", "agent"), flowNode("right", "output", "output")],
  edges: [
    { id: "edge-1", from: "left", to: "mid", from_port: null, to_port: null, edge_kind: "event_output", execution_semantics: "normal_transition", data_label: "", schema_ref: null, route_condition: null, state_key: null, artifact_key: null, a2a_contract_id: null, is_remote_boundary_crossing: false },
    { id: "edge-2", from: "mid", to: "right", from_port: null, to_port: null, edge_kind: "event_output", execution_semantics: "normal_transition", data_label: "", schema_ref: null, route_condition: null, state_key: null, artifact_key: null, a2a_contract_id: null, is_remote_boundary_crossing: false }
  ],
  containers: [
    { id: "container-root", module_id: null, label: "Root", container_kind: "graph_workflow", adk_mapping: null, contains_node_ids: ["left", "mid", "right"], entry_node_ids: ["left"], exit_node_ids: ["right"], layout_policy: "dag_with_routes", parent_container_id: null }
  ],
  lanes: [],
  validation: { ok: true, errors: [], warnings: [] }
};

// 1) freeze pins every node to a finite position.
const frozen = freezeGraphLayout(flowGraph);
for (const node of frozen.nodes) {
  assert.ok(node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y), `${node.id} frozen position`);
}

// 2) capture the frozen render, then "drag" mid to a new spot.
const beforeById = new Map(layoutGraphIR(frozen, { nodeId: null, edgeId: null }, () => undefined).nodes.map((n) => [n.id, n.position]));
const draggedMid = { x: beforeById.get("mid")!.x + 140, y: beforeById.get("mid")!.y + 90 };
const movedGraph: GraphIR = {
  ...frozen,
  nodes: frozen.nodes.map((node) => (node.id === "mid" ? { ...node, position: { ...draggedMid } } : node))
};
const afterById = new Map(layoutGraphIR(movedGraph, { nodeId: null, edgeId: null }, () => undefined).nodes.map((n) => [n.id, n.position]));

// 3) only mid moved; left and right (incl. the node to mid's right) stay put.
assert.deepEqual(afterById.get("mid"), draggedMid, "dragged node should land where dropped");
assert.deepEqual(afterById.get("left"), beforeById.get("left"), "node left of the dragged node must not move");
assert.deepEqual(afterById.get("right"), beforeById.get("right"), "node right of the dragged node must not move");
