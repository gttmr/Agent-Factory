import assert from "node:assert/strict";
import { layoutGraphIR } from "./layout.ts";
import type { GraphIR } from "../analyzer/types.ts";

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
