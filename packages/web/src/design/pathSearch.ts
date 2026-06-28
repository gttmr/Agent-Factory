import type { GraphEdge, GraphIR } from "../analyzer/types";

export interface GraphPath {
  nodeIds: string[];
  edgeIds: string[];
}

interface QueueItem {
  nodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  visited: Set<string>;
}

export function findSimplePaths(graphIR: GraphIR, fromId: string, toId: string, limit = 5): GraphPath[] {
  if (!fromId || !toId || limit <= 0) return [];
  if (fromId === toId) return [{ nodeIds: [fromId], edgeIds: [] }];

  const bySource = new Map<string, GraphEdge[]>();
  for (const edge of graphIR.edges ?? []) {
    if (!edge.from || !edge.to) continue;
    const current = bySource.get(edge.from) ?? [];
    current.push(edge);
    bySource.set(edge.from, current);
  }

  for (const edges of bySource.values()) {
    edges.sort((a, b) => {
      const byTarget = a.to.localeCompare(b.to);
      if (byTarget !== 0) return byTarget;
      return a.id.localeCompare(b.id);
    });
  }

  const paths: GraphPath[] = [];
  const queue: QueueItem[] = [{ nodeId: fromId, nodeIds: [fromId], edgeIds: [], visited: new Set([fromId]) }];
  const maxDepth = Math.max((graphIR.nodes ?? []).length, 1);

  for (let cursor = 0; cursor < queue.length && paths.length < limit; cursor += 1) {
    const item = queue[cursor];
    if (item.nodeIds.length > maxDepth) continue;

    for (const edge of bySource.get(item.nodeId) ?? []) {
      if (item.visited.has(edge.to)) continue;
      const nextNodeIds = [...item.nodeIds, edge.to];
      const nextEdgeIds = [...item.edgeIds, edge.id];
      if (edge.to === toId) {
        paths.push({ nodeIds: nextNodeIds, edgeIds: nextEdgeIds });
        if (paths.length >= limit) break;
        continue;
      }
      queue.push({
        nodeId: edge.to,
        nodeIds: nextNodeIds,
        edgeIds: nextEdgeIds,
        visited: new Set([...item.visited, edge.to])
      });
    }
  }

  return paths;
}
