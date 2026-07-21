import type { ScaffoldPlan } from "../../analyzer/types";

export interface AdkGraphReadiness {
  readonly routeEdges: number;
  readonly defaultRouteEdges: number;
  readonly humanInputNodes: number;
  readonly unsupportedHumanInputNodes: readonly string[];
  readonly joinNodes: number;
  readonly loopRegions: number;
  readonly dynamicWorkflowAssets: number;
}

export function buildAdkGraphReadiness(plan: ScaffoldPlan | null): AdkGraphReadiness {
  const graph = plan?.graph;
  const routeNodeIds = new Set(
    graph?.nodes
      .filter((node) => node.node_kind === "function" && node.role === "route")
      .map((node) => node.id) ?? []
  );
  const routeEdges = graph?.edges.filter(
    (edge) => routeNodeIds.has(edge.from) && edge.control.kind === "condition"
  ) ?? [];
  const humanInputNodes = graph?.nodes.filter((node) => node.node_kind === "human_input") ?? [];
  return {
    routeEdges: routeEdges.length,
    defaultRouteEdges: routeEdges.filter((edge) => edge.control.default).length,
    humanInputNodes: humanInputNodes.length,
    unsupportedHumanInputNodes: humanInputNodes
      .filter((node) => {
        const responseSchema = node.human_input_contract.response_schema_ref;
        return responseSchema !== null && responseSchema !== "str";
      })
      .map((node) => node.id),
    joinNodes: graph?.nodes.filter((node) => node.node_kind === "join").length ?? 0,
    loopRegions: graph?.regions.filter((region) => region.kind === "loop").length ?? 0,
    dynamicWorkflowAssets: plan?.assets.filter(
      (asset) => asset.asset_type === "workflow" && asset.workflow_profile?.representation === "dynamic"
    ).length ?? 0
  };
}
