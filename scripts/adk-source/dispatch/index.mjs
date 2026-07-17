import { EDGE_KIND_HANDLERS } from "./edge-kinds.mjs";
import {
  NODE_KIND_HANDLERS,
  syntheticJoinCollisionTarget
} from "./node-kinds.mjs";
import {
  assembleSmokeGraphWorkflowEdges,
  edgeCapabilityForMode,
  lowerEdgeForMode,
  nodeCapabilityForMode,
  resolveNodeEndpointForMode,
  runtimeNodeNameForMode
} from "./modes.mjs";

const DEFAULT_EDGE_KIND = "event_output";
const DEFAULT_EXECUTION_SEMANTICS = "normal_transition";

export { EDGE_KIND_HANDLERS, NODE_KIND_HANDLERS };

export function handlerForNode(node) {
  const kind = typeof node === "string" ? node : node?.node_kind;
  const handler = NODE_KIND_HANDLERS[kind];
  if (!handler) throw new Error(`ADK graph dispatch has no node handler for ${kind ?? "missing node_kind"}.`);
  return handler;
}

export function handlerForEdge(edge) {
  const kind = typeof edge === "string" ? edge : edge?.edge_kind;
  const handler = EDGE_KIND_HANDLERS[kind];
  if (!handler) throw new Error(`ADK graph dispatch has no edge handler for ${kind ?? "missing edge_kind"}.`);
  return handler;
}

export function collectNodeTarget(node, context) {
  const handler = handlerForNode(node);
  const module = typeof node.module_id === "string" ? context.graph.moduleById.get(node.module_id) ?? null : null;
  const target = module
    ? { node, module, moduleNodeCount: context.counts.get(module.id) ?? 1 }
    : node;
  const capability = nodeCapabilityForMode(handler, { ...context, node, module, target });
  const deliberatelyExcluded = Boolean(
    module && context.mode !== "smoke" && (context.exclusions.has(module.id) || context.exclusions.has(node.id))
  );
  const collisionTargets = capability.supported && !deliberatelyExcluded
    ? handler.collisionTargets(target, { seenModuleIds: context.seenCollisionModuleIds })
    : [];
  return Object.freeze({
    handler,
    target,
    module,
    capability,
    deliberatelyExcluded,
    collectionRole: deliberatelyExcluded ? "toolset_exclusion" : handler.collectionRole,
    collectionBucket: handler.collectionBucket,
    featureFlags: handler.featureFlags,
    collisionTargets
  });
}

export function nodeCapability(node, context) {
  const handler = handlerForNode(node);
  const module = typeof node?.module_id === "string" ? context.graph.moduleById.get(node.module_id) ?? null : null;
  const target = module
    ? { node, module, moduleNodeCount: context.counts.get(module.id) ?? 1 }
    : node;
  return nodeCapabilityForMode(handler, { ...context, node, module, target });
}

export function nodeForcesDynamic(node, graph) {
  const handler = handlerForNode(node);
  const module = typeof node?.module_id === "string" ? graph.moduleById.get(node.module_id) ?? null : null;
  return handler.forcesDynamic({ node, module });
}

export function resolveRuntimeEndpoint(nodeId, { mode, side, graph, counts, exclusions = new Set() }) {
  const node = graph.nodesById.get(nodeId);
  if (!node) return null;
  const handler = handlerForNode(node);
  const module = typeof node.module_id === "string" ? graph.moduleById.get(node.module_id) ?? null : null;
  const target = module ? { node, module, moduleNodeCount: counts.get(module.id) ?? 1 } : node;
  return resolveNodeEndpointForMode(handler, { mode, side, graph, counts, exclusions, node, module, target });
}

export function resolveRuntimeName(node, { mode, graph, counts }) {
  if (!node) throw new Error(`${mode} runnable internal plan error: runtime-name node is missing from Graph IR.`);
  const handler = handlerForNode(node);
  const module = typeof node.module_id === "string" ? graph.moduleById.get(node.module_id) ?? null : null;
  const target = module ? { node, module, moduleNodeCount: counts.get(module.id) ?? 1 } : node;
  const name = runtimeNodeNameForMode(handler, { mode, graph, counts, node, module, target });
  if (!name) throw new Error(`${mode} runnable internal plan error: no runtime name for ${node.id}.`);
  return name;
}

export function emissionForNode(target, { mode, context }) {
  const node = target.node ?? target;
  const handler = handlerForNode(node);
  const module = target.module ?? null;
  const capability = nodeCapabilityForMode(handler, { mode, node, module, target, graph: context.graphContext });
  if (!capability.supported) {
    throw new Error(`${mode} runnable codegen cannot emit ${node.id}: ${capability.reason}.`);
  }
  if (typeof handler.emission !== "function") {
    throw new Error(`${mode} runnable codegen: node handler for ${node.node_kind} has no emission callback.`);
  }
  return handler.emission(target, context);
}

export function collisionTargetForSyntheticJoin(join) {
  return syntheticJoinCollisionTarget(join);
}

export function normalizeDispatchEdge(edge, index = 0) {
  if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
    throw new Error(`ADK graph dispatch found an invalid edge record at index ${index}.`);
  }
  return Object.freeze({
    ...edge,
    edge_kind: edge.edge_kind ?? DEFAULT_EDGE_KIND,
    execution_semantics: edge.execution_semantics ?? DEFAULT_EXECUTION_SEMANTICS,
    key: typeof edge.id === "string" && edge.id.trim() ? edge.id : `edge:${index}:${edge.from}->${edge.to}`
  });
}

export function edgeCapability(edge, { mode, graph, counts, exclusions = new Set(), index = 0 }) {
  const normalized = normalizeDispatchEdge(edge, index);
  const handler = handlerForEdge(normalized);
  const fromNode = graph.nodesById.get(normalized.from);
  const toNode = graph.nodesById.get(normalized.to);
  if (!fromNode || !toNode) {
    return Object.freeze({
      edge: normalized,
      handler,
      capability: Object.freeze({
        supported: false,
        reason: `dangling endpoints ${normalized.from ?? "?"}->${normalized.to ?? "?"}`
      })
    });
  }
  const capability = edgeCapabilityForMode(handler, {
    mode,
    edge: normalized,
    graph,
    counts,
    exclusions,
    fromNode,
    toNode
  });
  return Object.freeze({ edge: normalized, handler, capability });
}

export function validateAndLowerEdge(edge, { mode, graph, counts, exclusions = new Set(), index = 0 }) {
  const dispatch = edgeCapability(edge, { mode, graph, counts, exclusions, index });
  if (!dispatch.capability.supported) {
    throw new Error(
      `${mode} graph edge handler cannot lower ${dispatch.edge.from ?? "?"}->${dispatch.edge.to ?? "?"} ` +
      `(${dispatch.edge.edge_kind}/${dispatch.edge.execution_semantics}): ${dispatch.capability.reason}.`
    );
  }
  const fromNode = graph.nodesById.get(dispatch.edge.from);
  const toNode = graph.nodesById.get(dispatch.edge.to);
  const resolveEndpoint = (nodeId, side) =>
    resolveRuntimeEndpoint(nodeId, { mode, side, graph, counts, exclusions });
  const lowered = lowerEdgeForMode(dispatch.handler, {
    mode,
    edge: dispatch.edge,
    graph,
    counts,
    exclusions,
    fromNode,
    toNode,
    resolveEndpoint
  });
  if (!lowered.capability.supported || !lowered.record) {
    throw new Error(
      `${mode} graph edge handler accepted ${dispatch.edge.key} without a lowering record: ${lowered.capability.reason}.`
    );
  }
  return lowered.record;
}

export function edgeForcesDynamic(edge) {
  const normalized = normalizeDispatchEdge(edge);
  return handlerForEdge(normalized).forcesDynamic(normalized);
}

export function buildSmokeGraphWorkflowEdges(context, collection) {
  return assembleSmokeGraphWorkflowEdges(context, collection, (edge, index) =>
    validateAndLowerEdge(edge, {
      mode: "smoke",
      graph: collection.graph,
      counts: collection.counts,
      exclusions: new Set(),
      index
    })
  );
}
