export function graphIndexes({ assets, graph }) {
  const assetById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodesById = new Map(nodes.filter((node) => node && typeof node.id === "string").map((node) => [node.id, node]));
  const assetNodes = nodes.filter((node) => {
    const ref = nodeAssetRef(node);
    return typeof ref === "string" && assetById.has(ref);
  });
  return { assetById, assetNodes, nodes, nodesById };
}

export function nodeAssetRef(node) {
  if (node?.node_kind === "agent") return node.agent_ref ?? null;
  if (node?.node_kind === "tool") return node.tool_ref ?? null;
  if (node?.node_kind === "subworkflow") return node.workflow_ref ?? null;
  return null;
}

export function startNodeIds(context) {
  const graph = graphIndexes(context);
  const executableIds = new Set(graph.nodes.filter((node) => node.node_kind !== "input" && node.node_kind !== "output").map((node) => node.id));
  const targets = new Set(
    (context.graph.edges ?? [])
      .filter((edge) => executableIds.has(edge.from) && executableIds.has(edge.to))
      .map((edge) => edge.to)
  );
  return [...executableIds].filter((id) => !targets.has(id));
}

export function terminalOutputIds({ graph }) {
  return (graph.nodes ?? []).filter((node) => node?.node_kind === "output" && typeof node.id === "string").map((node) => node.id);
}

export function validateGraphCoverage(context) {
  const graph = graphIndexes(context);
  const usedAssetIds = new Set(graph.assetNodes.map(nodeAssetRef));
  for (const node of graph.nodes) {
    for (const available of node.available_tools ?? []) usedAssetIds.add(available.tool_ref);
  }
  const rootRef = context.graph.workflow_ref;
  if (rootRef) usedAssetIds.add(rootRef);
  const missing = context.assets.filter((asset) => !usedAssetIds.has(asset.asset_id)).map((asset) => asset.asset_id);
  if (missing.length > 0) throw new Error(`Graph IR does not reference scaffold-plan assets: ${missing.join(", ")}`);
}

export function assetNodeCounts(context) {
  const graph = isGraphIndex(context) ? context : graphIndexes(context);
  const counts = new Map();
  for (const node of graph.assetNodes) {
    const ref = nodeAssetRef(node);
    counts.set(ref, (counts.get(ref) ?? 0) + 1);
  }
  return counts;
}

export function assetNodeSpec(node, graph, counts = assetNodeCounts(graph)) {
  const ref = nodeAssetRef(node);
  if (!ref) return null;
  const asset = graph.assetById.get(ref);
  if (!asset) return null;
  return { node, asset, assetNodeCount: counts.get(asset.asset_id) ?? 1 };
}

export function orderedGraphNodeSpecs(context, options = {}) {
  const graph = graphIndexes(context);
  const counts = assetNodeCounts(graph);
  const excludeAssetIds = options.excludeAssetIds ?? new Set();
  return graph.assetNodes
    .map((node) => assetNodeSpec(node, graph, counts))
    .filter((spec) => spec && !excludeAssetIds.has(spec.asset.asset_id));
}

function isGraphIndex(value) {
  return Boolean(value?.assetById && value?.nodesById && Array.isArray(value?.assetNodes));
}

export function graphNodeSemantics({ graph }) {
  return (graph.nodes ?? []).map((node) => ({
    id: node.id ?? null,
    node_kind: node.node_kind ?? null,
    role: node.role ?? null,
    agent_ref: node.agent_ref ?? null,
    tool_ref: node.tool_ref ?? null,
    workflow_ref: node.workflow_ref ?? null,
    invocation_control: node.invocation_control ?? null,
    available_tools: node.available_tools ?? []
  }));
}

export function graphEdgeSemantics({ graph }) {
  return (graph.edges ?? []).map((edge) => ({
    id: edge.id ?? null,
    from: edge.from ?? null,
    to: edge.to ?? null,
    control: edge.control ?? null,
    channel: edge.channel ?? null
  }));
}
