import type { GraphNode, ModuleCandidate, ModuleCategory } from "../analyzer/types";

export interface GraphEdgeIdSource {
  readonly id?: string | null;
}

export function graphNodeKindToModuleCategory(kind: GraphNode["node_kind"] | string | null | undefined): ModuleCategory | null {
  switch (kind) {
    case "agent":
    case "workflow":
    case "adapter":
    case "remote_a2a":
      return kind;
    case "workflow_call":
      return "workflow";
    case "adapter_call":
      return "adapter";
    case "remote_agent_call":
      return "remote_a2a";
    default:
      return null;
  }
}

export function graphEdgeId(edge: GraphEdgeIdSource, index: number): string {
  return edge.id ?? `edge-${index}`;
}

export function graphModuleSubtype(candidate: ModuleCandidate | null | undefined): string | null {
  if (!candidate) return null;
  switch (candidate.module_category) {
    case "agent":
      return candidate.agent_kind ?? null;
    case "workflow":
      return candidate.workflow_kind ?? null;
    case "adapter":
      return candidate.adapter_kind ?? null;
    case "remote_a2a":
      return candidate.remote_contract_kind ?? null;
  }
}
