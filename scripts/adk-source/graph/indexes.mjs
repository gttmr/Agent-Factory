export function graphIndexes({ modules, processFlow }) {
  const moduleById = new Map(modules.map((module) => [module.id, module]));
  const nodes = Array.isArray(processFlow.nodes) ? processFlow.nodes : [];
  const nodesById = new Map(nodes.filter((node) => node && typeof node.id === "string").map((node) => [node.id, node]));
  const moduleNodes = nodes.filter(
    (node) => node && typeof node.module_id === "string" && moduleById.has(node.module_id)
  );
  return { moduleById, moduleNodes, nodes, nodesById };
}

export function startNodeIds(context) {
  const graph = graphIndexes(context);
  const moduleNodeIds = new Set(graph.moduleNodes.map((node) => node.id));
  const moduleTargets = new Set(
    (Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [])
      .filter((edge) => moduleNodeIds.has(edge.from) && moduleNodeIds.has(edge.to))
      .map((edge) => edge.to)
  );
  return [...moduleNodeIds].filter((id) => !moduleTargets.has(id));
}

export function terminalOutputIds({ processFlow }) {
  if (!Array.isArray(processFlow.nodes)) return [];
  return processFlow.nodes
    .filter((node) => node && node.node_kind === "output" && typeof node.id === "string")
    .map((node) => node.id);
}

export function validateGraphCoverage(context) {
  const graph = graphIndexes(context);
  const graphModuleIds = new Set(graph.moduleNodes.map((node) => node.module_id));
  const missing = context.modules.filter((module) => !graphModuleIds.has(module.id)).map((module) => module.id);
  if (missing.length > 0) {
    throw new Error(`processFlow is missing Graph IR nodes for scaffold-plan modules: ${missing.join(", ")}`);
  }
}

export function moduleNodeCounts(context) {
  const graph = isGraphIndex(context) ? context : graphIndexes(context);
  const counts = new Map();
  for (const node of graph.moduleNodes) {
    counts.set(node.module_id, (counts.get(node.module_id) ?? 0) + 1);
  }
  return counts;
}

export function moduleNodeSpec(node, graph, counts = moduleNodeCounts(graph)) {
  if (!node || typeof node.module_id !== "string") return null;
  const module = graph.moduleById.get(node.module_id);
  if (!module) return null;
  return { node, module, moduleNodeCount: counts.get(module.id) ?? 1 };
}

export function orderedGraphNodeSpecs(context, options = {}) {
  const graph = graphIndexes(context);
  const counts = moduleNodeCounts(graph);
  const excludeModuleIds = options.excludeModuleIds ?? new Set();
  return graph.moduleNodes
    .map((node) => moduleNodeSpec(node, graph, counts))
    .filter((spec) => spec && !excludeModuleIds.has(spec.module.id));
}

function isGraphIndex(value) {
  return Boolean(value?.moduleById && value?.nodesById && Array.isArray(value?.moduleNodes));
}

export function graphNodeSemantics({ processFlow }) {
  return (Array.isArray(processFlow.nodes) ? processFlow.nodes : []).map((node) => ({
    id: node.id ?? null,
    module_id: node.module_id ?? null,
    node_kind: node.node_kind ?? null,
    invoke_binding: node.invoke_binding ?? null,
    decision_owner: node.decision_owner ?? null,
    call_control: node.call_control ?? null,
    side_effect: node.side_effect ?? null,
    policy: node.policy ?? null
  }));
}

export function graphEdgeSemantics({ processFlow }) {
  return (Array.isArray(processFlow.edges) ? processFlow.edges : []).map((edge) => ({
    id: edge.id ?? null,
    from: edge.from ?? null,
    to: edge.to ?? null,
    edge_kind: edge.edge_kind ?? null,
    flow_kind: edge.flow_kind ?? null,
    call_control: edge.call_control ?? null
  }));
}
