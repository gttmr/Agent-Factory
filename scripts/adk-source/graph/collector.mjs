import { agentOwnedToolsetAdapterIds } from "../adapters.mjs";
import { collectNodeTarget } from "../dispatch/index.mjs";
import { graphIndexes, moduleNodeCounts } from "./indexes.mjs";

export function collectGenerationNodes(context, { mode }) {
  const graph = graphIndexes(context);
  const counts = moduleNodeCounts(graph);
  const toolsetAdapterIds = agentOwnedToolsetAdapterIds({
    ...context,
    processFlow: {
      ...context.processFlow,
      edges: (Array.isArray(context.processFlow.edges) ? context.processFlow.edges : []).filter(
        (edge) => edge && typeof edge === "object" && !Array.isArray(edge)
      )
    }
  });
  const exclusions = mode === "smoke" ? new Set() : toolsetAdapterIds;
  const seenCollisionModuleIds = new Set();
  const buckets = {
    moduleSpecsInDeclarationOrder: [],
    humanInputNodes: [],
    routerNodes: [],
    terminalOutputNodes: [],
    explicitJoinNodes: [],
    loopControlNodes: []
  };
  const unsupportedNodes = [];
  const collisionTargets = [];
  const featureFlags = new Set();
  const coverage = new Map();

  for (const node of graph.nodes) {
    const collected = collectNodeTarget(node, {
      mode,
      graph,
      counts,
      exclusions,
      seenCollisionModuleIds
    });
    coverage.set(node.id, collected.collectionRole);
    for (const flag of collected.featureFlags) featureFlags.add(flag);
    collisionTargets.push(...collected.collisionTargets);
    if (!collected.capability.supported) {
      unsupportedNodes.push({ node, ...collected.capability });
    }
    if (collected.deliberatelyExcluded || !collected.collectionBucket) continue;
    if (collected.collectionBucket === "moduleSpecsInDeclarationOrder" && !collected.module) continue;
    buckets[collected.collectionBucket].push(collected.target);
  }

  if (toolsetAdapterIds.size > 0) featureFlags.add("toolsets");
  return {
    graph,
    counts,
    toolsetAdapterIds,
    ...buckets,
    unsupportedNodes,
    collisionTargets,
    featureFlags,
    coverage
  };
}
