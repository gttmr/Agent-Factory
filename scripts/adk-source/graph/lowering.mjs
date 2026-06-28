import { nodeSymbol, pyGraphNodeName, syntheticNodeSymbol } from "../naming.mjs";
import { toPyStr } from "../python-literals.mjs";
import { graphIndexes } from "./indexes.mjs";
import { routeValue } from "./routes.mjs";

export function buildRunnableGraph(context) {
  const graph = graphIndexes(context);
  const explicitJoinNodes = graph.nodes.filter((node) => node.node_kind === "join");
  const explicitJoinSymbols = new Set(explicitJoinNodes.map((node) => syntheticNodeSymbol(node)));
  const resolve = (nodeId, side) => {
    const node = graph.nodesById.get(nodeId);
    if (!node) return null;
    if (typeof node.module_id === "string" && graph.moduleById.has(node.module_id)) {
      return nodeSymbol(graph.moduleById.get(node.module_id));
    }
    if (side === "from" && node.node_kind === "input") return "START";
    if (node.node_kind === "human_input" || node.node_kind === "join" || node.node_kind === "router") {
      return syntheticNodeSymbol(node);
    }
    return null; // output nodes (terminal markers) and unknowns are dropped
  };

  const baseEdges = [];
  const routeEdgesBySource = new Map();
  const seen = new Set();
  const add = (from, to, edge = {}) => {
    if (!from || !to || from === to) return;
    const key = `${from}->${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    baseEdges.push({
      from,
      to,
      fanIn: edge.execution_semantics === "fan_in" || edge.flow_kind === "fan_in",
      route: edge.edge_kind === "route"
    });
  };

  if (Array.isArray(context.processFlow.edges)) {
    for (const edge of context.processFlow.edges) {
      const from = resolve(edge.from, "from");
      const to = resolve(edge.to, "to");
      if (from && to && from === to && from !== "START") {
        throw new Error(
          `runnable mode does not support self-loop/loop Graph IR yet (node ${from}). Use smoke mode or wait for loop lowering.`
        );
      }
      if (edge.edge_kind === "route") {
        if (from && to) {
          if (!routeEdgesBySource.has(from)) routeEdgesBySource.set(from, []);
          routeEdgesBySource.get(from).push({ value: routeValue(edge), target: to });
        }
        add(from, to, edge);
        continue;
      }
      add(from, to, edge);
    }
  }

  const incoming = new Set(baseEdges.map((edge) => edge.to));
  for (const node of graph.moduleNodes) {
    const sym = nodeSymbol(graph.moduleById.get(node.module_id));
    if (!incoming.has(sym)) add("START", sym);
  }

  const sourcesByTarget = new Map();
  for (const edge of baseEdges) {
    if (!sourcesByTarget.has(edge.to)) sourcesByTarget.set(edge.to, []);
    sourcesByTarget.get(edge.to).push(edge);
  }
  const joins = explicitJoinNodes.map((node) => ({
    sym: syntheticNodeSymbol(node),
    name: pyGraphNodeName(node),
    nodeId: node.id,
    explicit: true
  }));
  const finalEdges = [];
  const joined = new Set();
  let joinIndex = 0;
  for (const [target, sources] of sourcesByTarget) {
    if (sources.length > 1 && sources.some((edge) => edge.fanIn) && !explicitJoinSymbols.has(target)) {
      const joinSym = `join_${++joinIndex}`;
      joins.push({ sym: joinSym, name: joinSym, target, explicit: false });
      for (const source of sources) finalEdges.push({ kind: "pair", from: source.from, to: joinSym });
      finalEdges.push({ kind: "pair", from: joinSym, to: target });
      joined.add(target);
    }
  }
  for (const edge of baseEdges) {
    if (!joined.has(edge.to) && !edge.route) finalEdges.push({ kind: "pair", from: edge.from, to: edge.to });
  }
  for (const [from, routes] of routeEdgesBySource) {
    const uniqueRoutes = [];
    const seenRouteValues = new Set();
    for (const route of routes) {
      if (seenRouteValues.has(route.value)) continue;
      seenRouteValues.add(route.value);
      uniqueRoutes.push(route);
    }
    finalEdges.push({ kind: "route", from, routes: uniqueRoutes });
  }

  if (finalEdges.length === 0) {
    throw new Error("processFlow does not provide any usable Graph IR edges for runnable workflow generation.");
  }

  const adjacency = new Map();
  for (const [from, to] of runtimePairs(finalEdges)) {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  }
  const reachable = new Set(["START"]);
  const queue = ["START"];
  while (queue.length) {
    for (const next of adjacency.get(queue.shift()) ?? []) {
      if (!reachable.has(next)) {
        reachable.add(next);
        queue.push(next);
      }
    }
  }
  const unreachable = [...new Set(runtimePairs(finalEdges).flat())].filter((sym) => sym !== "START" && !reachable.has(sym));
  if (unreachable.length > 0) {
    throw new Error(
      `runnable mode produced nodes unreachable from START: ${unreachable.join(", ")}. Ensure every node (incl. human_input/join) has an incoming path from an input node. Use smoke mode.`
    );
  }
  assertAcyclic(runtimePairs(finalEdges));
  return { edges: finalEdges, joins };
}

export function runtimePairs(edgeSpecs) {
  const pairs = [];
  for (const spec of edgeSpecs) {
    if (spec.kind === "pair") {
      pairs.push([spec.from, spec.to]);
      continue;
    }
    if (spec.kind === "route") {
      for (const route of spec.routes) pairs.push([spec.from, route.target]);
    }
  }
  return pairs;
}

export function workflowEdgeLiteral(edgeSpecs) {
  if (!Array.isArray(edgeSpecs) || edgeSpecs.length === 0) return "[]";
  const rows = edgeSpecs.map((spec) => {
    if (spec.kind === "route") {
      const routeRows = spec.routes.map((route) => `            ${toPyStr(route.value)}: ${route.target},`).join("\n");
      return `        (${spec.from}, {\n${routeRows}\n        }),`;
    }
    return `        (${spec.from}, ${spec.to}),`;
  });
  return `[\n${rows.join("\n")}\n    ]`;
}

export function assertAcyclic(edges) {
  const adjacency = new Map();
  const inDegree = new Map();
  const nodes = new Set();
  for (const [from, to] of edges) {
    nodes.add(from);
    nodes.add(to);
  }
  for (const node of nodes) {
    adjacency.set(node, []);
    inDegree.set(node, 0);
  }
  for (const [from, to] of edges) {
    adjacency.get(from).push(to);
    inDegree.set(to, inDegree.get(to) + 1);
  }
  const queue = [...nodes].filter((node) => inDegree.get(node) === 0);
  let visited = 0;
  while (queue.length) {
    const node = queue.shift();
    visited += 1;
    for (const next of adjacency.get(node)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) queue.push(next);
    }
  }
  if (visited !== nodes.size) {
    const inCycle = [...nodes].filter((node) => inDegree.get(node) > 0);
    throw new Error(
      `runnable mode does not support cyclic/loop Graph IR yet (cycle involves: ${inCycle.join(", ")}). Use smoke mode or wait for loop lowering.`
    );
  }
}
