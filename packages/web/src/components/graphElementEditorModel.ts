import type { GraphEdge, GraphNode } from "../analyzer/types";

export type GraphElementTabId = "basic" | "contract" | "runtime" | "policy" | "mock" | "adk";

export interface GraphElementTab {
  id: GraphElementTabId;
  label: string;
}

export const GRAPH_ELEMENT_TABS: GraphElementTab[] = [
  { id: "basic", label: "기본" },
  { id: "contract", label: "계약" },
  { id: "runtime", label: "실행" },
  { id: "policy", label: "정책" },
  { id: "mock", label: "Mock" },
  { id: "adk", label: "ADK" }
];

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
