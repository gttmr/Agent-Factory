import { EDGE_CONTROL_HANDLERS } from "./edge-controls.mjs";
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
import { nodeAssetRef } from "../graph/indexes.mjs";

const DEFAULT_CONTROL_KIND = "next";

export { EDGE_CONTROL_HANDLERS, NODE_KIND_HANDLERS };

export function handlerForNode(node) {
  const kind = typeof node === "string" ? node : node?.node_kind;
  const handler = NODE_KIND_HANDLERS[kind];
  if (!handler) throw new Error(`ADK graph dispatch has no node handler for ${kind ?? "missing node_kind"}.`);
  return handler;
}

export function handlerForEdge(edge) {
  const kind = typeof edge === "string" ? edge : edge?.control?.kind;
  const handler = EDGE_CONTROL_HANDLERS[kind];
  if (!handler) throw new Error(`ADK graph dispatch has no edge handler for ${kind ?? "missing control kind"}.`);
  return handler;
}

export function collectNodeTarget(node, context) {
  const handler = handlerForNode(node);
  const ref = nodeAssetRef(node);
  const asset = ref ? context.graph.assetById.get(ref) ?? null : null;
  const target = asset
    ? { node, asset, assetNodeCount: context.counts.get(asset.asset_id) ?? 1 }
    : node;
  const capability = nodeCapabilityForMode(handler, { ...context, node, asset, target });
  const deliberatelyExcluded = Boolean(
    asset && context.mode !== "smoke" && (context.exclusions.has(asset.asset_id) || context.exclusions.has(node.id))
  );
  const collisionTargets = capability.supported && !deliberatelyExcluded
    ? handler.collisionTargets(target, { seenAssetIds: context.seenCollisionAssetIds })
    : [];
  return Object.freeze({
    handler,
    target,
    asset,
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
  const ref = nodeAssetRef(node);
  const asset = ref ? context.graph.assetById.get(ref) ?? null : null;
  const target = asset
    ? { node, asset, assetNodeCount: context.counts.get(asset.asset_id) ?? 1 }
    : node;
  return nodeCapabilityForMode(handler, { ...context, node, asset, target });
}

export function nodeForcesDynamic(node, graph) {
  const handler = handlerForNode(node);
  const ref = nodeAssetRef(node);
  const asset = ref ? graph.assetById.get(ref) ?? null : null;
  return handler.forcesDynamic({ node, asset });
}

export function resolveRuntimeEndpoint(nodeId, { mode, side, graph, counts, exclusions = new Set() }) {
  const node = graph.nodesById.get(nodeId);
  if (!node) return null;
  const handler = handlerForNode(node);
  const ref = nodeAssetRef(node);
  const asset = ref ? graph.assetById.get(ref) ?? null : null;
  const target = asset ? { node, asset, assetNodeCount: counts.get(asset.asset_id) ?? 1 } : node;
  return resolveNodeEndpointForMode(handler, { mode, side, graph, counts, exclusions, node, asset, target });
}

export function resolveRuntimeName(node, { mode, graph, counts }) {
  if (!node) throw new Error(`${mode} runnable internal plan error: runtime-name node is missing from Graph IR.`);
  const handler = handlerForNode(node);
  const ref = nodeAssetRef(node);
  const asset = ref ? graph.assetById.get(ref) ?? null : null;
  const target = asset ? { node, asset, assetNodeCount: counts.get(asset.asset_id) ?? 1 } : node;
  const name = runtimeNodeNameForMode(handler, { mode, graph, counts, node, asset, target });
  if (!name) throw new Error(`${mode} runnable internal plan error: no runtime name for ${node.id}.`);
  return name;
}

export function emissionForNode(target, { mode, context }) {
  const node = target.node ?? target;
  const handler = handlerForNode(node);
  const asset = target.asset ?? null;
  const capability = nodeCapabilityForMode(handler, { mode, node, asset, target, graph: context.graphContext });
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
    control: edge.control ?? Object.freeze({ kind: DEFAULT_CONTROL_KIND }),
    channel: edge.channel ?? null,
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
      `(${dispatch.edge.control.kind}/${dispatch.edge.channel ?? "control"}): ${dispatch.capability.reason}.`
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
