import assert from "node:assert/strict";
import { layoutGraphIR } from "./layout.ts";
import type { GraphIR, GraphNode } from "../../analyzer/types.ts";
import { graphEdgeId, graphNodeKindToAssetType } from "../../graph/graphDisplay.ts";

const humanNode: GraphNode = {
  id: "human-choice",
  label: "분기 선택",
  node_kind: "human_input",
  human_input_contract: {
    message: "분기값을 입력하세요.",
    payload_schema_ref: null,
    response_schema_ref: "str",
    response_mapping: null,
    choice_options: ["run_analysis", "skip_analysis"],
    accepted_aliases: { skip_analysis: ["skip", "건너뛰기"] },
    default_choice: "skip_analysis"
  }
};

const graph: GraphIR = {
  graph_id: "graph-target",
  source_requirement_id: "req-target",
  workflow_ref: "asset-root-workflow",
  nodes: [
    { id: "input", label: "Input", node_kind: "input" },
    humanNode,
    { id: "route", label: "Route", node_kind: "function", role: "route" },
    { id: "agent", label: "Agent", node_kind: "agent", agent_ref: "asset-agent", available_tools: [] },
    { id: "output", label: "Output", node_kind: "output" }
  ],
  edges: [
    { id: "edge-1", from: "input", to: "human-choice", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "edge-2", from: "human-choice", to: "route", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
    { id: "edge-3", from: "route", to: "agent", control: { kind: "condition", condition: "choice == run_analysis", accepted_aliases: ["run", "분석"], default: false }, channel: null },
    { id: "edge-4", from: "route", to: "output", control: { kind: "condition", condition: "choice == skip_analysis", accepted_aliases: ["skip", "건너뛰기"], default: true }, channel: null }
  ],
  regions: [
    { id: "loop-review", kind: "loop", node_ids: ["human-choice", "route", "agent"], entry_node_ids: ["human-choice"], exit_node_ids: ["agent"], parent_region_id: null }
  ]
};

const presentationPositions = new Map([
  ["input", { x: 480, y: 320 }],
  ["human-choice", { x: 760, y: 320 }]
]);
const layout = layoutGraphIR(graph, { nodeId: null, edgeId: null }, () => undefined, presentationPositions);

assert.deepEqual(layout.nodes.find((node) => node.id === "input")?.position, { x: 480, y: 320 });
assert.deepEqual(layout.nodes.find((node) => node.id === "human-choice")?.position, { x: 760, y: 320 });
assert.ok(layout.nodes.find((node) => node.id === "route"), "unpositioned nodes still receive derived layout");
assert.equal(layout.regionRects[0]?.region.id, "loop-review", "region overlays are derived from Target regions");
assert.equal(graphNodeKindToAssetType("agent"), "agent");
assert.equal(graphNodeKindToAssetType("tool"), "tool");
assert.equal(graphNodeKindToAssetType("subworkflow"), "workflow");
assert.equal(graphNodeKindToAssetType("function"), null);
assert.equal(graphEdgeId({ id: "reviewed-edge" }, 3), "reviewed-edge");

const routeNode = layout.nodes.find((node) => node.id === "route");
assert.equal(routeNode?.data.upstreamHumanPrompt, "분기값을 입력하세요.");
assert.deepEqual(routeNode?.data.routeMap, [
  { value: "run_analysis", aliases: ["run", "분석"], isDefault: false, targetNodeId: "agent", targetLabel: "Agent" },
  { value: "skip_analysis", aliases: ["skip", "건너뛰기"], isDefault: true, targetNodeId: "output", targetLabel: "Output" }
]);

assert.deepEqual(
  Object.keys(graph).sort(),
  ["edges", "graph_id", "nodes", "regions", "source_requirement_id", "workflow_ref"],
  "Graph IR persists only Target root fields"
);
