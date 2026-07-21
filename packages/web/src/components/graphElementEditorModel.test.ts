import assert from "node:assert/strict";
import {
  GRAPH_ELEMENT_GROUPS,
  TARGET_NODE_KIND_OPTIONS,
  availableGraphElementGroups,
  assetRefForNode,
  graphRegionLabel,
  isA2AProtocolBoundary,
  isAssetBoundNodeKind,
  invocationControlLabel,
  nextGraphElementGroupAfterSelectionChange
} from "./graphElementEditorModel.ts";
import type { AssetCandidate, GraphEdge, GraphNode } from "../analyzer/types";

const edge: GraphEdge = {
  id: "edge-route",
  from: "route",
  to: "target",
  control: {
    kind: "condition",
    condition: "choice == run",
    accepted_aliases: ["run", "실행"],
    default: false
  },
  channel: "event"
};

const agentNode: GraphNode = {
  id: "agent-node",
  label: "Agent",
  node_kind: "agent",
  agent_ref: "asset-agent",
  available_tools: [{ tool_ref: "asset-tool", invocation_control: "agent" }]
};

const agentAsset = {
  asset_id: "asset-agent",
  asset_type: "agent",
  binding: { kind: "a2a", contract_ref: "a2a-agent" },
  exposure: null,
  inputs: [{ name: "message", type: "string", required: true }],
  outputs: [],
  risk_level: "low",
  risk_signals: [],
  missing_information: []
} as unknown as AssetCandidate;

assert.deepEqual(
  TARGET_NODE_KIND_OPTIONS.map((option) => option.value),
  ["input", "agent", "tool", "function", "human_input", "subworkflow", "join", "output"],
  "editor offers only Target node kinds"
);
assert.equal(graphRegionLabel("parallel"), "병렬 실행 범위");
assert.equal(graphRegionLabel("loop"), "반복 실행 범위");
assert.equal(invocationControlLabel("workflow"), "Workflow");
assert.equal(invocationControlLabel("agent"), "Agent");
assert.deepEqual(
  GRAPH_ELEMENT_GROUPS.map((group) => group.id),
  ["summary", "io", "flow", "runtime", "risk", "raw"],
  "legacy ADK/runtime implementation groups do not survive in the Target editor"
);
assert.equal(isAssetBoundNodeKind("agent"), true);
assert.equal(isAssetBoundNodeKind("tool"), true);
assert.equal(isAssetBoundNodeKind("subworkflow"), true);
assert.equal(isAssetBoundNodeKind("function"), false);
assert.equal(assetRefForNode(agentNode), "asset-agent");
assert.equal(
  assetRefForNode({ id: "tool-node", label: "Tool", node_kind: "tool", tool_ref: "asset-tool", invocation_control: "workflow" }),
  "asset-tool"
);
assert.equal(
  assetRefForNode({ id: "workflow-node", label: "Workflow", node_kind: "subworkflow", workflow_ref: "asset-workflow" }),
  "asset-workflow"
);
assert.equal(isA2AProtocolBoundary(agentNode, agentAsset), true, "A2A is a marker on an Agent-bound node");
assert.equal(
  isA2AProtocolBoundary(
    { id: "tool-node", label: "Tool", node_kind: "tool", tool_ref: "asset-tool", invocation_control: "workflow" },
    { ...agentAsset, asset_id: "asset-tool", asset_type: "tool" }
  ),
  false,
  "A2A never becomes a Tool category"
);

assert.deepEqual(
  availableGraphElementGroups({ selectedNode: agentNode, selectedEdge: null, asset: agentAsset }).map((group) => group.id),
  ["summary", "io", "runtime", "risk", "raw"],
  "Agent details expose typed refs, available tools, asset IO, and review risk"
);
assert.deepEqual(
  availableGraphElementGroups({ selectedNode: null, selectedEdge: edge, asset: null }).map((group) => group.id),
  ["summary", "flow", "runtime", "raw"],
  "edges expose control, condition aliases, and channel without legacy edge fields"
);
assert.equal(
  nextGraphElementGroupAfterSelectionChange(
    "risk",
    availableGraphElementGroups({ selectedNode: null, selectedEdge: edge, asset: null })
  ),
  "summary",
  "selection changes fall back when the previous group is unavailable"
);
