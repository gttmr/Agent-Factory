import type { ScaffoldPlan } from "../../analyzer/types";

export interface AdkGraphReadiness {
  readonly routeEdges: number;
  readonly defaultRouteEdges: number;
  readonly humanInputNodes: number;
  readonly unsupportedHumanInputNodes: readonly string[];
  readonly joinNodes: number;
  readonly loopControlNodes: number;
  readonly dynamicWorkflowModules: number;
}

export function buildAdkGraphReadiness(plan: ScaffoldPlan | null): AdkGraphReadiness {
  const graph = plan?.graph;
  const routeEdges = graph?.edges.filter((edge) => edge.edge_kind === "route") ?? [];
  const humanInputNodes = graph?.nodes.filter((node) => node.node_kind === "human_input") ?? [];
  return {
    routeEdges: routeEdges.length,
    defaultRouteEdges: routeEdges.filter((edge) => edge.is_default_route === true).length,
    humanInputNodes: humanInputNodes.length,
    unsupportedHumanInputNodes: humanInputNodes
      .filter((node) => {
        const responseSchema = node.human_input_contract?.response_schema_ref;
        return responseSchema !== undefined && responseSchema !== null && responseSchema !== "str";
      })
      .map((node) => node.id),
    joinNodes: graph?.nodes.filter((node) => node.node_kind === "join").length ?? 0,
    loopControlNodes: graph?.nodes.filter((node) => node.node_kind === "loop_control").length ?? 0,
    dynamicWorkflowModules: plan?.modules.filter((module) => module.workflow_kind === "dynamic").length ?? 0
  };
}
