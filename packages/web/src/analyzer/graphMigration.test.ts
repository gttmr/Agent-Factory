import assert from "node:assert/strict";
import { normalizeGraphIRForRuntime } from "./graphMigration.ts";
import type { GraphIR } from "./types.ts";

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
