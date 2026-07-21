import type { AssetCandidate, AssetType, GraphNode } from "../analyzer/types";

export interface GraphEdgeIdSource {
  readonly id?: string | null;
}

export function graphNodeKindToAssetType(
  kind: GraphNode["node_kind"] | string | null | undefined
): AssetType | null {
  if (kind === "agent") return "agent";
  if (kind === "tool") return "tool";
  if (kind === "subworkflow") return "workflow";
  return null;
}

export function graphEdgeId(edge: GraphEdgeIdSource, index: number): string {
  return edge.id ?? `edge-${index}`;
}

export function graphAssetSubtype(asset: AssetCandidate | null | undefined): string | null {
  if (!asset) return null;
  if (asset.asset_type === "agent") return asset.binding?.kind === "a2a" || asset.exposure?.protocol === "a2a" ? "A2A" : asset.binding?.kind ?? null;
  if (asset.asset_type === "workflow") return asset.workflow_profile?.representation ?? null;
  return asset.binding?.kind ?? null;
}
