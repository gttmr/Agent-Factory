import { edgeCapability } from "../dispatch/index.mjs";
import { collectGenerationNodes } from "./collector.mjs";

export function assertRunnableGraphSupported(context, options = {}) {
  const unsupportedContainerKinds = new Set(["dynamic_workflow", "loop_region"]);
  const collection = options.collection ?? collectGenerationNodes(context, { mode: "static" });
  const structuredHumanInputs = collection.unsupportedNodes.filter((entry) => entry.code === "structured_human_input");
  const badNodes = collection.unsupportedNodes
    .filter((entry) => entry.code !== "structured_human_input")
    .map((entry) => `${entry.node.id} (${entry.node.node_kind}: ${entry.reason})`);
  if (badNodes.length > 0) {
    throw new Error(
      `runnable mode cannot lower these nodes yet: ${badNodes.join(", ")}. Supported nodes are input/output, synthetic human_input/join/router, and module-bound agent/adapter/workflow/remote_a2a/remote_agent_call nodes (no loop-control or module_id-null intermediary nodes). Use smoke mode.`
    );
  }
  if (structuredHumanInputs.length > 0) {
    throw new Error(
      `runnable mode cannot lower structured human_input response schemas yet: ${structuredHumanInputs.map((entry) => `${entry.node.id} (${entry.reason})`).join(", ")}. Use response_schema_ref "str" or smoke mode.`
    );
  }

  const containers = Array.isArray(context.processFlow.containers) ? context.processFlow.containers : [];
  const badContainers = containers
    .filter((container) => container && unsupportedContainerKinds.has(container.container_kind))
    .map((container) => `${container.id} (${container.container_kind})`);
  if (badContainers.length > 0) {
    throw new Error(
      `runnable mode does not support these container regions yet: ${badContainers.join(", ")}. parallel_region, human_review_region, and remote_boundary are visual groupings only; use smoke mode or wait for loop/dynamic lowering.`
    );
  }

  const edges = Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [];
  const badEdges = [];
  const defaultRouteEdgesByRouter = new Map();
  for (const [index, edge] of edges.entries()) {
    const dispatch = edgeCapability(edge, {
      mode: "static",
      graph: collection.graph,
      counts: collection.counts,
      exclusions: collection.toolsetAdapterIds,
      index
    });
    if (!dispatch.capability.supported) {
      badEdges.push(
        `${dispatch.edge.from}->${dispatch.edge.to} (${dispatch.edge.edge_kind}/${dispatch.edge.execution_semantics}: ${dispatch.capability.reason})`
      );
      continue;
    }
    if (dispatch.handler.kind !== "route" || dispatch.edge.is_default_route !== true) continue;
    const defaults = defaultRouteEdgesByRouter.get(dispatch.edge.from) ?? [];
    defaults.push(dispatch.edge.id ?? `${dispatch.edge.from}->${dispatch.edge.to}`);
    defaultRouteEdgesByRouter.set(dispatch.edge.from, defaults);
  }
  if (badEdges.length > 0) {
    throw new Error(
      `runnable mode does not support these edges yet: ${badEdges.join(", ")}. Supported DAG edges include normal fan-out/fan-in transitions, reviewed router route edges, and genuine remote_a2a edges; use smoke mode or wait for loop/dynamic lowering.`
    );
  }
  const duplicateDefaults = [...defaultRouteEdgesByRouter.entries()]
    .filter(([, defaults]) => defaults.length > 1)
    .map(([routerId, defaults]) => `${routerId}: ${defaults.join(", ")}`);
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
