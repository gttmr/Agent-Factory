import type { GraphIR } from "../analyzer/types";

export function appendNodeToRegion(
  regions: GraphIR["regions"],
  regionId: string,
  nodeId: string
): GraphIR["regions"] {
  return regions.map((region) =>
    region.id === regionId ? { ...region, node_ids: appendUnique(region.node_ids, nodeId) } : region
  );
}

export function moveNodeToRegion(
  regions: GraphIR["regions"],
  nodeId: string,
  nextRegionId: string | null
): GraphIR["regions"] {
  return regions.map((region) => {
    const stripped = {
      ...region,
      node_ids: region.node_ids.filter((id) => id !== nodeId),
      entry_node_ids: region.entry_node_ids.filter((id) => id !== nodeId),
      exit_node_ids: region.exit_node_ids.filter((id) => id !== nodeId)
    };
    return nextRegionId === region.id
      ? { ...stripped, node_ids: appendUnique(stripped.node_ids, nodeId) }
      : stripped;
  });
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}
