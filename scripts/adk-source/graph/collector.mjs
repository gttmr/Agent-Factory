import { agentOwnedToolIds } from "../tools.mjs";
import { collectNodeTarget } from "../dispatch/index.mjs";
import { assetNodeCounts, graphIndexes } from "./indexes.mjs";

export function collectGenerationNodes(context, { mode }) {
  const graph = graphIndexes(context);
  const counts = assetNodeCounts(graph);
  const agentOwnedIds = agentOwnedToolIds({
    ...context,
    graph: {
      ...context.graph,
      edges: (Array.isArray(context.graph.edges) ? context.graph.edges : []).filter(
        (edge) => edge && typeof edge === "object" && !Array.isArray(edge)
      )
    }
  });
  const exclusions = mode === "smoke" ? new Set() : agentOwnedIds;
  const seenCollisionAssetIds = new Set();
  const buckets = {
    assetSpecsInDeclarationOrder: [],
    functionNodes: [],
    humanInputNodes: [],
    routeNodes: [],
    terminalOutputNodes: [],
    explicitJoinNodes: []
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
      seenCollisionAssetIds
    });
    coverage.set(node.id, collected.collectionRole);
    for (const flag of collected.featureFlags) featureFlags.add(flag);
    collisionTargets.push(...collected.collisionTargets);
    if (!collected.capability.supported) {
      unsupportedNodes.push({ node, ...collected.capability });
    }
    if (collected.deliberatelyExcluded || !collected.collectionBucket) continue;
    if (collected.collectionBucket === "assetSpecsInDeclarationOrder" && !collected.asset) continue;
    buckets[collected.collectionBucket].push(collected.target);
  }

  if (agentOwnedIds.size > 0) featureFlags.add("toolsets");
  return {
    graph,
    counts,
    agentOwnedToolIds: agentOwnedIds,
    ...buckets,
    unsupportedNodes,
    collisionTargets,
    featureFlags,
    coverage
  };
}
