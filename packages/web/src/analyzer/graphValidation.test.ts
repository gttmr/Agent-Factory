import assert from "node:assert/strict";
import { validateGraphIR } from "./graphValidation.ts";
import type { GraphIR } from "./types.ts";

const graph: GraphIR = {
  graph_id: "graph-001",
  source_requirement_id: "req-001",
  workflow_ref: "workflow.review",
  nodes: [
    { id: "node-input", label: "Input", node_kind: "input" },
    { id: "node-route", label: "Route", node_kind: "function", role: "route" },
    { id: "node-agent", label: "Agent", node_kind: "agent", agent_ref: "agent.reviewer", available_tools: [] },
    { id: "node-output", label: "Output", node_kind: "output" }
  ],
  edges: [
    { id: "edge-001", from: "node-input", to: "node-route", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "edge-002", from: "node-route", to: "node-agent", control: { kind: "condition", condition: "approved", accepted_aliases: ["yes"], default: false }, channel: "state" },
    { id: "edge-003", from: "node-agent", to: "node-route", control: { kind: "loop_back", condition: "retry", accepted_aliases: [], default: false }, channel: "event" },
    { id: "edge-004", from: "node-agent", to: "node-output", control: { kind: "callback", condition: null, accepted_aliases: [], default: true }, channel: "event" }
  ],
  regions: [
    { id: "region-loop", kind: "loop", node_ids: ["node-route", "node-agent"], entry_node_ids: ["node-route"], exit_node_ids: ["node-agent"], parent_region_id: null }
  ]
};

assert.deepEqual(validateGraphIR(graph), { ok: true, errors: [], warnings: [] });
assert.equal(validateGraphIR({ ...graph, workflow_ref: null }).ok, true, "standalone graph may omit a Workflow asset ref");

const retiredShape = { ...structuredClone(graph), lanes: [], containers: [], validation: { ok: true, errors: [], warnings: [] } };
assert.match(validateGraphIR(retiredShape).errors.map((entry) => entry.message).join("\n"), /lanes|containers|validation/);

const oldEdge = structuredClone(graph);
Object.assign(oldEdge.edges[0], { edge_kind: "route", flow_kind: "sequence", call_control: "fixed_by_workflow" });
assert.match(validateGraphIR(oldEdge).errors.map((entry) => entry.message).join("\n"), /edge_kind|flow_kind|call_control/);

const unknownHumanInput = structuredClone(graph);
unknownHumanInput.nodes.splice(1, 0, {
  id: "node-human",
  label: "Human review",
  node_kind: "human_input",
  human_input_contract: {
    message: "Approve?",
    payload_schema_ref: null,
    response_schema_ref: null,
    response_mapping: null,
    legacy_prompt: "Approve?"
  }
} as never);
assert.match(validateGraphIR(unknownHumanInput).errors.map((entry) => entry.message).join("\n"), /legacy_prompt/);

const duplicateNode = structuredClone(graph);
duplicateNode.nodes.push({ ...duplicateNode.nodes[0] });
assert.match(validateGraphIR(duplicateNode).errors.map((entry) => entry.code).join("\n"), /duplicate_node_id/);

const regionEntryOutsideMembership = structuredClone(graph);
regionEntryOutsideMembership.regions[0].entry_node_ids = ["node-output"];
assert.match(validateGraphIR(regionEntryOutsideMembership).errors.map((entry) => entry.code).join("\n"), /invalid_region_membership/);

const danglingParent = structuredClone(graph);
danglingParent.regions[0].parent_region_id = "region-missing";
assert.match(validateGraphIR(danglingParent).errors.map((entry) => entry.code).join("\n"), /dangling_parent_region/);

const cyclicParents = structuredClone(graph);
cyclicParents.regions.push({
  id: "region-parent",
  kind: "parallel",
  node_ids: ["node-route", "node-agent"],
  entry_node_ids: ["node-route"],
  exit_node_ids: ["node-agent"],
  parent_region_id: "region-loop"
});
cyclicParents.regions[0].parent_region_id = "region-parent";
assert.match(validateGraphIR(cyclicParents).errors.map((entry) => entry.code).join("\n"), /cyclic_parent_region/);

console.log("strict Target Graph IR tests passed");
