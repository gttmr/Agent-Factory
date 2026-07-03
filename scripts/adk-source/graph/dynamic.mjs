import { agentOwnedToolsetAdapterIds } from "../adapters.mjs";
import { graphIndexes, moduleNodeCounts, moduleNodeSpec } from "./indexes.mjs";
import { routeAliases, routeValue } from "./routes.mjs";
import { nodeSymbol, syntheticNodeSymbol } from "../naming.mjs";

export function hasDynamicRunnableShape({ modules, processFlow }) {
  const nodes = Array.isArray(processFlow?.nodes) ? processFlow.nodes : [];
  const edges = Array.isArray(processFlow?.edges) ? processFlow.edges : [];
  const containers = Array.isArray(processFlow?.containers) ? processFlow.containers : [];
  return (
    modules.some((module) => module.module_category === "workflow" && module.workflow_kind === "dynamic") ||
    nodes.some((node) => node?.node_kind === "loop_control") ||
    edges.some((edge) => edge?.execution_semantics === "loop_back" || edge?.execution_semantics === "loop_exit") ||
    containers.some((container) => container?.container_kind === "loop_region" || container?.container_kind === "dynamic_workflow")
  );
}

export function assertDynamicRunnableGraphSupported(context) {
  const graph = graphIndexes(context);
  const allowedBareKinds = new Set(["input", "output", "human_input", "join", "loop_control"]);
  const syntheticKinds = new Set([...allowedBareKinds, "router"]);
  const badNodes = [];
  for (const node of graph.nodes) {
    if (!node) continue;
    const module = typeof node.module_id === "string" ? graph.moduleById.get(node.module_id) : null;
    if (syntheticKinds.has(node.node_kind) && module) {
      badNodes.push(`${node.id} (${node.node_kind})`);
      continue;
    }
    if (module) continue;
    if (allowedBareKinds.has(node.node_kind)) continue;
    badNodes.push(`${node.id} (${node.node_kind})`);
  }
  if (badNodes.length) {
    throw new Error(
      `dynamic runnable mode cannot lower these nodes yet: ${badNodes.join(", ")}. Supported dynamic nodes are module-bound nodes plus input/output, human_input, join, and loop_control.`
    );
  }

  const edges = Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [];
  const badEdges = [];
  for (const edge of edges) {
    if (!edge) continue;
    const fromNode = graph.nodesById.get(edge.from);
    const toNode = graph.nodesById.get(edge.to);
    if (!fromNode || !toNode) {
      badEdges.push(`${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
      continue;
    }
    const isLoopEdge = edge.execution_semantics === "loop_back" || edge.execution_semantics === "loop_exit";
    if (isLoopEdge) {
      if (fromNode.node_kind !== "loop_control") {
        badEdges.push(`${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
      }
      continue;
    }
    if (edge.execution_semantics === "conditional" || edge.edge_kind === "route") {
      badEdges.push(`${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
      continue;
    }
    const touchesRemote = isRemoteAgentGraphNode(fromNode) || isRemoteAgentGraphNode(toNode);
    if (edge.edge_kind === "remote_a2a") {
      if (!touchesRemote) badEdges.push(`${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
      continue;
    }
    if (edge.is_remote_boundary_crossing === true && !touchesRemote) {
      badEdges.push(`${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
      continue;
    }
    if (fromNode.node_kind === "output" || toNode.node_kind === "input") {
      badEdges.push(`${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
    }
  }
  if (badEdges.length) {
    throw new Error(
      `dynamic runnable mode does not support these edges yet: ${badEdges.join(", ")}. Use reviewed loop_control loop_back/loop_exit edges or static runnable routing.`
    );
  }
}

export function buildDynamicRunnablePlan(context) {
  const graph = graphIndexes(context);
  const counts = moduleNodeCounts(graph);
  const nodes = graph.nodes;
  const toolsetAdapterIds = agentOwnedToolsetAdapterIds(context);
  const loopRegions = (Array.isArray(context.processFlow.containers) ? context.processFlow.containers : []).filter(
    (container) => container?.container_kind === "loop_region"
  );
  const loopRegionByNode = new Map();
  for (const region of loopRegions) {
    for (const nodeId of Array.isArray(region.contains_node_ids) ? region.contains_node_ids : []) {
      loopRegionByNode.set(nodeId, region);
    }
  }

  const steps = [];
  const handledRegions = new Set();
  for (const node of nodes) {
    if (!runtimeSymbolFor(node, graph, toolsetAdapterIds, counts)) continue;
    const region = loopRegionByNode.get(node.id);
    if (region) {
      if (!handledRegions.has(region.id)) {
        steps.push(buildLoopStep(region, nodes, graph, context, toolsetAdapterIds, counts));
        handledRegions.add(region.id);
      }
      continue;
    }
    if (node.node_kind === "loop_control") {
      throw new Error(`dynamic runnable mode cannot lower loop_control ${node.id} unless it belongs to a loop_region container.`);
    }
    steps.push({ kind: "run", symbol: runtimeSymbolFor(node, graph, toolsetAdapterIds, counts), nodeId: node.id });
  }

  if (!steps.length) {
    throw new Error("dynamic runnable mode did not find any lowerable graph nodes.");
  }
  return {
    steps,
    loopControls: nodes.filter((node) => node?.node_kind === "loop_control")
  };
}

function buildLoopStep(region, nodes, graph, context, toolsetAdapterIds, counts) {
  const contained = new Set(Array.isArray(region.contains_node_ids) ? region.contains_node_ids : []);
  const loopControlNodes = nodes.filter((node) => contained.has(node.id) && node.node_kind === "loop_control");
  if (loopControlNodes.length !== 1) {
    throw new Error(`loop_region ${region.id} requires exactly one loop_control node for dynamic runnable lowering.`);
  }
  const loopControl = loopControlNodes[0];
  const body = nodes
    .filter((node) => contained.has(node.id) && node.id !== loopControl.id)
    .map((node) => ({ node, symbol: runtimeSymbolFor(node, graph, toolsetAdapterIds, counts) }))
    .filter((entry) => entry.symbol && entry.node.node_kind !== "join");
  if (!body.length) {
    throw new Error(`loop_region ${region.id} has no lowerable body nodes before ${loopControl.id}.`);
  }
  const edges = Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [];
  const outgoing = edges.filter((edge) => edge?.from === loopControl.id);
  const backEdges = outgoing.filter((edge) => edge.execution_semantics === "loop_back");
  const exitEdges = outgoing.filter((edge) => edge.execution_semantics === "loop_exit");
  if (!backEdges.length || !exitEdges.length) {
    throw new Error(`loop_control ${loopControl.id} requires both loop_back and loop_exit edges.`);
  }
  const backAliases = edgeAliases(backEdges, loopControl.id, "loop_back");
  const exitAliases = edgeAliases(exitEdges, loopControl.id, "loop_exit", { allowDefault: true });
  const defaultAction =
    humanInputDefaultAction(body, backAliases, exitAliases, loopControl.id) ?? edgeDefaultAction(backEdges, exitEdges);
  return {
    kind: "loop",
    regionId: region.id,
    controlNodeId: loopControl.id,
    controlSymbol: syntheticNodeSymbol(loopControl),
    body,
    backAliases,
    exitAliases,
    defaultAction
  };
}

function edgeAliases(edges, controlNodeId, semantic, options = {}) {
  const aliases = [];
  for (const edge of edges) {
    const hasCondition = typeof edge.route_condition === "string" && edge.route_condition.trim();
    const hasAliases = Array.isArray(edge.route_aliases) && edge.route_aliases.some((alias) => typeof alias === "string" && alias.trim());
    if (!hasCondition && !hasAliases && !(options.allowDefault && edge.is_default_route === true)) {
      throw new Error(`loop_control ${controlNodeId} requires reviewed route_condition or route_aliases for ${semantic} edge ${edge.id ?? `${edge.from}->${edge.to}`}.`);
    }
    if (hasCondition) aliases.push(...routeAliases(routeValue(edge), edge));
    else aliases.push(...edge.route_aliases.map((alias) => alias.trim().toLowerCase()).filter(Boolean));
  }
  return [...new Set(aliases)];
}

function humanInputDefaultAction(body, backAliases, exitAliases, controlNodeId) {
  const defaultChoices = body
    .map((entry) => entry.node?.human_input_contract?.default_choice)
    .filter((choice) => typeof choice === "string" && choice.trim());
  for (const choice of defaultChoices) {
    const choiceAliases = routeAliases(choice);
    const matchesBack = choiceAliases.some((alias) => backAliases.includes(alias));
    const matchesExit = choiceAliases.some((alias) => exitAliases.includes(alias));
    if (matchesBack && matchesExit) {
      throw new Error(`loop_control ${controlNodeId} has ambiguous human_input default_choice ${choice}.`);
    }
    if (matchesBack) return "loop_back";
    if (matchesExit) return "loop_exit";
  }
  return null;
}

function edgeDefaultAction(backEdges, exitEdges) {
  if (exitEdges.some((edge) => edge.is_default_route === true)) return "loop_exit";
  if (backEdges.some((edge) => edge.is_default_route === true)) return "loop_back";
  return "loop_exit";
}

function runtimeSymbolFor(node, graph, excludedModuleIds = new Set(), counts = moduleNodeCounts(graph)) {
  if (!node) return null;
  if (typeof node.module_id === "string" && graph.moduleById.has(node.module_id)) {
    if (excludedModuleIds.has(node.module_id)) return null;
    return nodeSymbol(moduleNodeSpec(node, graph, counts));
  }
  if (node.node_kind === "human_input" || node.node_kind === "loop_control" || node.node_kind === "output") {
    return syntheticNodeSymbol(node);
  }
  return null;
}

function isRemoteAgentGraphNode(node) {
  return node?.node_kind === "remote_a2a" || node?.node_kind === "remote_agent_call";
}
