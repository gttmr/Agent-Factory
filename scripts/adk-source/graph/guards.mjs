import {
  funcName,
  hitlFuncName,
  nodeSymbol,
  pyGraphNodeName,
  pyNodeName,
  routeFuncName,
  stateKey,
  syntheticNodeSymbol
} from "../naming.mjs";
import { graphIndexes } from "./indexes.mjs";

export function assertRunnableGraphSupported(context) {
  const unsupportedExecSemantics = new Set(["loop_back", "loop_exit", "conditional", "boundary_crossing"]);
  const unsupportedEdgeKinds = new Set([]);
  const unsupportedContainerKinds = new Set(["dynamic_workflow", "loop_region"]);
  const nodes = Array.isArray(context.processFlow.nodes) ? context.processFlow.nodes : [];
  const graph = graphIndexes(context);
  const allowedBareKinds = new Set(["input", "output", "human_input", "join", "router"]);
  const unlowerableNodeKinds = new Set(["loop_control"]);
  const badNodes = [];
  for (const node of nodes) {
    if (!node) continue;
    const module = typeof node.module_id === "string" ? graph.moduleById.get(node.module_id) : null;
    if (allowedBareKinds.has(node.node_kind)) {
      if (module) badNodes.push(`${node.id} (${node.node_kind} bound to a module)`);
      continue;
    }
    if (unlowerableNodeKinds.has(node.node_kind)) {
      badNodes.push(`${node.id} (${node.node_kind})`);
      continue;
    }
    if (module) {
      if (module.module_category === "workflow" && module.workflow_kind === "dynamic") {
        badNodes.push(`${node.id} (dynamic workflow module)`);
      }
      continue;
    }
    badNodes.push(`${node.id} (${node.node_kind})`);
  }
  if (badNodes.length > 0) {
    throw new Error(
      `runnable mode cannot lower these nodes yet: ${badNodes.join(", ")}. Supported nodes are input/output, synthetic human_input/join/router, and module-bound agent/adapter/workflow/remote_a2a/remote_agent_call nodes (no loop-control or module_id-null intermediary nodes). Use smoke mode.`
    );
  }
  const unsupportedHumanInputSchemas = nodes
    .filter((node) => {
      if (node?.node_kind !== "human_input") return false;
      const responseSchemaRef = node.human_input_contract?.response_schema_ref;
      return responseSchemaRef !== undefined && responseSchemaRef !== null && responseSchemaRef !== "str";
    })
    .map((node) => `${node.id} (${node.human_input_contract.response_schema_ref})`);
  if (unsupportedHumanInputSchemas.length > 0) {
    throw new Error(
      `runnable mode cannot lower structured human_input response schemas yet: ${unsupportedHumanInputSchemas.join(", ")}. Use response_schema_ref "str" or smoke mode.`
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
  const badEdges = edges
    .filter((edge) => {
      if (!edge) return false;
      const fromNode = graph.nodesById.get(edge.from);
      const toNode = graph.nodesById.get(edge.to);
      if (!fromNode || !toNode) return true;
      const touchesRemote = isRemoteAgentGraphNode(fromNode) || isRemoteAgentGraphNode(toNode);
      if (edge.edge_kind === "remote_a2a" && !touchesRemote) return true;
      const isRouteEdge = edge.edge_kind === "route";
      if (isRouteEdge) {
        return (
          fromNode.node_kind !== "router" ||
          !edge.route_condition ||
          edge.execution_semantics !== "conditional" ||
          toNode.node_kind === "input" ||
          toNode.node_kind === "output" ||
          fromNode.node_kind === "output"
        );
      }
      const isGenuineRemoteEdge = edge.edge_kind === "remote_a2a" && touchesRemote;
      if (
        !isGenuineRemoteEdge &&
        (unsupportedExecSemantics.has(edge.execution_semantics) ||
          unsupportedEdgeKinds.has(edge.edge_kind) ||
          edge.is_remote_boundary_crossing === true)
      ) {
        return true;
      }
      return (
        fromNode.node_kind === "output" ||
        toNode.node_kind === "input" ||
        (fromNode.node_kind === "input" && toNode.node_kind === "output")
      );
    })
    .map((edge) => `${edge.from}->${edge.to} (${edge.edge_kind}/${edge.execution_semantics})`);
  if (badEdges.length > 0) {
    throw new Error(
      `runnable mode does not support these edges yet: ${badEdges.join(", ")}. Supported DAG edges include normal fan-out/fan-in transitions, reviewed router route edges, and genuine remote_a2a edges; use smoke mode or wait for loop/dynamic lowering.`
    );
  }
  const defaultRouteEdgesByRouter = new Map();
  for (const edge of edges) {
    if (edge?.edge_kind !== "route" || edge.is_default_route !== true) continue;
    const defaults = defaultRouteEdgesByRouter.get(edge.from) ?? [];
    defaults.push(edge.id ?? `${edge.from}->${edge.to}`);
    defaultRouteEdgesByRouter.set(edge.from, defaults);
  }
  const duplicateDefaults = [...defaultRouteEdgesByRouter.entries()]
    .filter(([, defaults]) => defaults.length > 1)
    .map(([routerId, defaults]) => `${routerId}: ${defaults.join(", ")}`);
  if (duplicateDefaults.length > 0) {
    throw new Error(`runnable mode route graph has multiple default route edges: ${duplicateDefaults.join("; ")}.`);
  }
}

export function assertNoSymbolCollisions(orderedModules, syntheticNodes = []) {
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
  for (const module of orderedModules) {
    check(module.id, [
      ["node symbol", nodeSymbol(module)],
      ["function name", funcName(module)],
      ["node name", pyNodeName(module)],
      ["state key", stateKey(module)]
    ]);
  }
  for (const node of syntheticNodes) {
    if (!node || node.explicit === false) {
      check(node.sym, [["node symbol", node.sym], ["node name", node.name]]);
    } else if (node.node_kind === "human_input") {
      check(node.id, [
        ["node symbol", syntheticNodeSymbol(node)],
        ["function name", hitlFuncName(node)],
        ["node name", pyGraphNodeName(node)]
      ]);
    } else if (node.node_kind === "router") {
      check(node.id, [
        ["node symbol", syntheticNodeSymbol(node)],
        ["function name", routeFuncName(node)],
        ["node name", pyGraphNodeName(node)]
      ]);
    } else if (node.node_kind === "loop_control") {
      check(node.id, [["node symbol", syntheticNodeSymbol(node)], ["node name", pyGraphNodeName(node)]]);
    } else if (node.node_kind === "join" || node.explicit === true) {
      check(node.id, [["node symbol", syntheticNodeSymbol(node)], ["node name", pyGraphNodeName(node)]]);
    }
  }
}

function isRemoteAgentGraphNode(node) {
  return node?.node_kind === "remote_a2a" || node?.node_kind === "remote_agent_call";
}
