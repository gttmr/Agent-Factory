import type { GraphEdge, GraphNode, ModuleCandidate } from "../analyzer/types";

export type GraphElementGroupId = "summary" | "io" | "flow" | "runtime" | "risk" | "adk" | "raw";
export type GraphElementTabId = GraphElementGroupId;

export interface GraphElementGroup {
  readonly id: GraphElementGroupId;
  readonly label: string;
}

export const GRAPH_ELEMENT_GROUPS: readonly GraphElementGroup[] = [
  { id: "summary", label: "요약" },
  { id: "io", label: "입출력" },
  { id: "flow", label: "흐름" },
  { id: "runtime", label: "호출·런타임" },
  { id: "risk", label: "검토·리스크" },
  { id: "adk", label: "ADK Skeleton" },
  { id: "raw", label: "원본" }
];

export const GRAPH_ELEMENT_TABS = GRAPH_ELEMENT_GROUPS;

const MODULE_NODE_KINDS = new Set<GraphNode["node_kind"]>([
  "agent",
  "workflow",
  "workflow_call",
  "adapter",
  "adapter_call",
  "remote_a2a",
  "remote_agent_call"
]);

export function isModuleBoundNodeKind(kind: GraphNode["node_kind"]): boolean {
  return MODULE_NODE_KINDS.has(kind);
}

export function hasIncidentEdge(nodeId: string, edges: GraphEdge[]): boolean {
  return edges.some((edge) => edge.from === nodeId || edge.to === nodeId);
}

export function hasNodeContract(node: GraphNode): boolean {
  return Boolean(
    node.workflow_ref ||
      node.input_schema ||
      node.output_schema ||
      node.input_mapping ||
      node.output_mapping ||
      node.mock_binding ||
      (node.schema_refs?.length ?? 0) > 0
  );
}

export function isNodeModuleLinkEditable(node: GraphNode, edges: GraphEdge[]): boolean {
  return isModuleBoundNodeKind(node.node_kind) && !hasIncidentEdge(node.id, edges) && !hasNodeContract(node);
}

export function isNodeRuntimeControlEditable(_node: GraphNode): boolean {
  return false;
}

export function isEdgeKindEditable(edge: GraphEdge): boolean {
  return edge.edge_kind !== "route" && edge.edge_kind !== "remote_a2a";
}

export interface GraphElementGroupInput {
  readonly selectedNode: GraphNode | null;
  readonly selectedEdge: GraphEdge | null;
  readonly candidate: ModuleCandidate | null;
}

export function availableGraphElementGroups(input: GraphElementGroupInput): readonly GraphElementGroup[] {
  const { selectedNode, selectedEdge, candidate } = input;
  if (!selectedNode && !selectedEdge) return [];
  return GRAPH_ELEMENT_GROUPS.filter((group) => isGraphElementGroupAvailable(group.id, selectedNode, selectedEdge, candidate));
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

function isGraphElementGroupAvailable(
  groupId: GraphElementGroupId,
  node: GraphNode | null,
  edge: GraphEdge | null,
  candidate: ModuleCandidate | null
): boolean {
  if (groupId === "summary" || groupId === "raw") return Boolean(node || edge);
  if (node) return isNodeGroupAvailable(groupId, node, candidate);
  if (edge) return isEdgeGroupAvailable(groupId, edge);
  return false;
}

function isNodeGroupAvailable(groupId: GraphElementGroupId, node: GraphNode, candidate: ModuleCandidate | null): boolean {
  if (groupId === "io") return hasNodeIoDetails(node, candidate);
  if (groupId === "flow") return hasNodeFlowDetails(node);
  if (groupId === "runtime") return hasNodeRuntimeDetails(node);
  if (groupId === "risk") return hasNodeRiskDetails(node, candidate);
  if (groupId === "adk") return hasNodeAdkDetails(node);
  return false;
}

function isEdgeGroupAvailable(groupId: GraphElementGroupId, edge: GraphEdge): boolean {
  if (groupId === "io") {
    return Boolean(edge.data_label || edge.schema_ref || edge.state_key || edge.artifact_key || edge.a2a_contract_id);
  }
  if (groupId === "flow") return true;
  if (groupId === "risk") return Boolean(edge.is_remote_boundary_crossing || edge.edge_kind === "remote_a2a");
  return false;
}

function hasNodeIoDetails(node: GraphNode, candidate: ModuleCandidate | null): boolean {
  return Boolean(
    node.input_schema ||
      node.output_schema ||
      hasValues(node.schema_refs) ||
      hasPortSchemas(node.input_ports) ||
      hasPortSchemas(node.output_ports) ||
      hasMapping(node.input_mapping) ||
      hasMapping(node.output_mapping) ||
      node.human_input_contract ||
      hasValues(candidate?.inputs) ||
      hasValues(candidate?.outputs)
  );
}

function hasNodeFlowDetails(node: GraphNode): boolean {
  return node.node_kind === "router" || node.node_kind === "human_input" || node.node_kind === "callback_wait" || node.node_kind === "loop_control";
}

function hasNodeRuntimeDetails(node: GraphNode): boolean {
  return Boolean(
    node.invoke_binding ||
      node.runtime_binding ||
      node.decision_owner ||
      node.call_control ||
      node.execution_kind ||
      node.agent_execution_mode ||
      node.mock_binding ||
      node.workflow_ref
  );
}

function hasNodeAdkDetails(node: GraphNode): boolean {
  if (node.node_kind !== "workflow" && node.node_kind !== "workflow_call") return false;
  return Boolean(node.adk_skeleton_contract || node.adk_node_role);
}

function hasNodeRiskDetails(node: GraphNode, candidate: ModuleCandidate | null): boolean {
  return Boolean(
    node.side_effect ||
      node.policy ||
      candidate?.risk_level ||
      hasValues(candidate?.risk_signals) ||
      hasValues(candidate?.missing_information)
  );
}

function hasMapping(value: Record<string, string> | null | undefined): boolean {
  return Boolean(value && Object.keys(value).length > 0);
}

function hasPortSchemas(ports: readonly { readonly schema_ref: string | null }[]): boolean {
  return ports.some((port) => Boolean(port.schema_ref));
}

function hasValues(value: readonly unknown[] | null | undefined): boolean {
  return Boolean(value && value.length > 0);
}
