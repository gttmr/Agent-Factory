import { edgeCapability } from "../dispatch/index.mjs";
import { collectGenerationNodes } from "./collector.mjs";

export function assertRunnableGraphSupported(context, options = {}) {
  const collection = options.collection ?? collectGenerationNodes(context, { mode: "static" });
  const structuredHumanInputs = collection.unsupportedNodes.filter((entry) => entry.code === "structured_human_input");
  const badNodes = collection.unsupportedNodes
    .filter((entry) => entry.code !== "structured_human_input")
    .map((entry) => `${entry.node.id} (${entry.node.node_kind}: ${entry.reason})`);
  if (badNodes.length > 0) {
    throw new Error(
      `runnable mode cannot lower these nodes yet: ${badNodes.join(", ")}. Supported Target nodes are input, agent, tool, function, human_input, subworkflow, join, and output.`
    );
  }
  if (structuredHumanInputs.length > 0) {
    throw new Error(
      `runnable mode cannot lower structured human_input response schemas yet: ${structuredHumanInputs.map((entry) => `${entry.node.id} (${entry.reason})`).join(", ")}. Use response_schema_ref "str" or smoke mode.`
    );
  }

  const edges = Array.isArray(context.graph.edges) ? context.graph.edges : [];
  const badEdges = [];
  const conditionRouteNodeIds = new Set();
  const defaultRouteEdgesByNode = new Map();
  for (const [index, edge] of edges.entries()) {
    const dispatch = edgeCapability(edge, {
      mode: "static",
      graph: collection.graph,
      counts: collection.counts,
      exclusions: collection.agentOwnedToolIds,
      index
    });
    if (!dispatch.capability.supported) {
      badEdges.push(
        `${dispatch.edge.from}->${dispatch.edge.to} (${dispatch.edge.control.kind}/${dispatch.edge.channel ?? "control"}: ${dispatch.capability.reason})`
      );
      continue;
    }
    if (dispatch.handler.kind !== "condition") continue;
    conditionRouteNodeIds.add(dispatch.edge.from);
    if (dispatch.edge.control.default !== true) continue;
    const defaults = defaultRouteEdgesByNode.get(dispatch.edge.from) ?? [];
    defaults.push(dispatch.edge.id ?? `${dispatch.edge.from}->${dispatch.edge.to}`);
    defaultRouteEdgesByNode.set(dispatch.edge.from, defaults);
  }
  if (badEdges.length > 0) {
    throw new Error(
      `runnable mode does not support these edges yet: ${badEdges.join(", ")}.`
    );
  }
  const missingDefaults = [...conditionRouteNodeIds].filter((nodeId) => !defaultRouteEdgesByNode.has(nodeId));
  if (missingDefaults.length > 0) {
    throw new Error(
      `runnable mode route nodes have no explicit default/unmatched contract: ${missingDefaults.join(", ")}.`
    );
  }
  const duplicateDefaults = [...defaultRouteEdgesByNode.entries()]
    .filter(([, defaults]) => defaults.length > 1)
    .map(([routeNodeId, defaults]) => `${routeNodeId}: ${defaults.join(", ")}`);
  if (duplicateDefaults.length > 0) {
    throw new Error(`runnable mode route graph has multiple default route edges: ${duplicateDefaults.join("; ")}.`);
  }
}

export function assertNoSymbolCollisions(collisionTargets) {
  const seen = new Map();
  const check = (owner, symbols) => {
    for (const [kind, value] of symbols) {
      const key = `${kind}::${value}`;
      if (seen.has(key)) {
        throw new Error(`runnable codegen ${kind} collision "${value}" between ${seen.get(key)} and ${owner}.`);
      }
      seen.set(key, owner);
    }
  };
  for (const target of collisionTargets) check(target.owner, target.symbols);
}
