import {
  graphNodeKinds,
  type AssetCandidate,
  type GraphEdge,
  type GraphNode,
  type GraphRegionKind,
  type InvocationControl,
  type NodeKind
} from "../analyzer/types";

export type GraphElementGroupId = "summary" | "io" | "flow" | "runtime" | "risk" | "raw";
export type GraphElementTabId = GraphElementGroupId;

export interface GraphElementGroup {
  readonly id: GraphElementGroupId;
  readonly label: string;
}

export const GRAPH_ELEMENT_GROUPS: readonly GraphElementGroup[] = [
  { id: "summary", label: "요약" },
  { id: "io", label: "입출력" },
  { id: "flow", label: "흐름" },
  { id: "runtime", label: "호출·채널" },
  { id: "risk", label: "검토·리스크" },
  { id: "raw", label: "원본" }
];

export const GRAPH_ELEMENT_TABS = GRAPH_ELEMENT_GROUPS;

const NODE_KIND_LABELS: Record<NodeKind, string> = {
  input: "입력",
  agent: "Agent",
  tool: "Tool",
  function: "Function",
  human_input: "사람 입력",
  subworkflow: "Subworkflow",
  join: "병합",
  output: "출력"
};

export const TARGET_NODE_KIND_OPTIONS = graphNodeKinds.map((value) => ({ value, label: NODE_KIND_LABELS[value] }));

const GRAPH_REGION_LABELS: Record<GraphRegionKind, string> = {
  parallel: "병렬 실행 범위",
  loop: "반복 실행 범위"
};

export function graphRegionLabel(kind: GraphRegionKind): string {
  return GRAPH_REGION_LABELS[kind];
}

const INVOCATION_CONTROL_LABELS: Record<InvocationControl, string> = {
  workflow: "Workflow",
  agent: "Agent"
};

export function invocationControlLabel(value: InvocationControl): string {
  return INVOCATION_CONTROL_LABELS[value];
}

export function isAssetBoundNodeKind(kind: GraphNode["node_kind"]): boolean {
  return kind === "agent" || kind === "tool" || kind === "subworkflow";
}

export function assetRefForNode(node: GraphNode | null | undefined): string | null {
  if (!node) return null;
  if (node.node_kind === "agent") return node.agent_ref;
  if (node.node_kind === "tool") return node.tool_ref;
  if (node.node_kind === "subworkflow") return node.workflow_ref;
  return null;
}

export function isA2AProtocolBoundary(
  node: GraphNode | null | undefined,
  asset: AssetCandidate | null | undefined
): boolean {
  return Boolean(
    node?.node_kind === "agent" &&
      asset?.asset_type === "agent" &&
      (asset.binding?.kind === "a2a" || asset.exposure?.protocol === "a2a")
  );
}

export interface GraphElementGroupInput {
  readonly selectedNode: GraphNode | null;
  readonly selectedEdge: GraphEdge | null;
  readonly asset: AssetCandidate | null;
}

export function availableGraphElementGroups(input: GraphElementGroupInput): readonly GraphElementGroup[] {
  const { selectedNode, selectedEdge, asset } = input;
  if (!selectedNode && !selectedEdge) return [];
  return GRAPH_ELEMENT_GROUPS.filter((group) => isGroupAvailable(group.id, selectedNode, selectedEdge, asset));
}

export function nextGraphElementGroupAfterSelectionChange(
  currentGroup: GraphElementGroupId,
  availableGroups: readonly GraphElementGroup[]
): GraphElementGroupId {
  return availableGroups.some((group) => group.id === currentGroup) ? currentGroup : "summary";
}

export function nextGraphElementTabAfterSelectionChange(currentTab: GraphElementTabId): GraphElementTabId {
  return nextGraphElementGroupAfterSelectionChange(currentTab, GRAPH_ELEMENT_GROUPS);
}

function isGroupAvailable(
  groupId: GraphElementGroupId,
  node: GraphNode | null,
  edge: GraphEdge | null,
  asset: AssetCandidate | null
): boolean {
  if (groupId === "summary" || groupId === "raw") return true;
  if (edge) {
    if (groupId === "flow") return true;
    if (groupId === "runtime") return edge.channel !== null;
    return false;
  }
  if (!node) return false;
  if (groupId === "io") return node.node_kind === "human_input" || Boolean(asset?.inputs.length || asset?.outputs.length);
  if (groupId === "flow") return node.node_kind === "function" || node.node_kind === "human_input";
  if (groupId === "runtime") return isAssetBoundNodeKind(node.node_kind);
  if (groupId === "risk") return Boolean(asset?.risk_level || asset?.risk_signals.length || asset?.missing_information.length);
  return false;
}
