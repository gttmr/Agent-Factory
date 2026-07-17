import {
  edgeForcesDynamic,
  handlerForNode,
  nodeForcesDynamic,
  resolveRuntimeEndpoint,
  resolveRuntimeName,
  validateAndLowerEdge
} from "../dispatch/index.mjs";
import { collectGenerationNodes } from "./collector.mjs";
import { graphIndexes } from "./indexes.mjs";
import { routeAliases, routeValue } from "./routes.mjs";

const TOOLSET_EXCLUSION_ROLE = "toolset_exclusion";

export function hasDynamicRunnableShape({ modules, processFlow }) {
  const graph = graphIndexes({ modules, processFlow });
  const nodes = Array.isArray(processFlow?.nodes) ? processFlow.nodes : [];
  const edges = Array.isArray(processFlow?.edges) ? processFlow.edges : [];
  const containers = Array.isArray(processFlow?.containers) ? processFlow.containers : [];
  return (
    modules.some((module) => module.module_category === "workflow" && module.workflow_kind === "dynamic") ||
    nodes.some((node) => node && nodeForcesDynamic(node, graph)) ||
    edges.some((edge) => edgeForcesDynamic(edge)) ||
    containers.some((container) => container?.container_kind === "loop_region" || container?.container_kind === "dynamic_workflow")
  );
}

export function assertDynamicRunnableGraphSupported(context, options = {}) {
  return analyzeDynamicGraph(context, options);
}

export function buildDynamicRunnablePlan(context, options = {}) {
  return analyzeDynamicGraph(context, options);
}

export function dynamicRunIdComponent(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function analyzeDynamicGraph(context, options = {}) {
  const collection = options.collection ?? collectGenerationNodes(context, { mode: "dynamic" });
  const { graph } = collection;
  const nodes = normalizeNodes(graph);
  const stableIndex = new Map(nodes.map((node, index) => [node.id, index]));
  validateNodeSupport(collection);
  const edges = normalizeEdges(context, collection);
  const excludedModuleIds = collection.toolsetAdapterIds;
  const excludedNodeIds = new Set(
    nodes.filter((node) => typeof node.module_id === "string" && excludedModuleIds.has(node.module_id)).map((node) => node.id)
  );
  const consumedEdgeIds = new Set();

  const forwardEdges = edges.filter((edge) => edge.dispatchRole !== "loop_back");
  stableTopologicalOrder(
    nodes.map((node) => node.id),
    forwardEdges,
    stableIndex,
    "dynamic graph outside sanctioned loop_back edges",
    consumedEdgeIds
  );

  const loops = analyzeLoops(context, nodes, edges, stableIndex, consumedEdgeIds, collection.loopControlNodes);
  const loopByNodeId = new Map();
  for (const loop of loops) {
    for (const nodeId of loop.operationalNodeIds) {
      if (loopByNodeId.has(nodeId)) {
        throw new Error(
          `dynamic runnable mode does not support overlapping loop closures: ${loopByNodeId.get(nodeId).regionId} and ${loop.regionId} both contain ${nodeId}.`
        );
      }
      loopByNodeId.set(nodeId, loop);
    }
  }
  for (const node of collection.loopControlNodes) {
    if (!loopByNodeId.has(node.id)) {
      throw new Error(`dynamic runnable mode cannot lower loop_control ${node.id} outside an operational loop closure.`);
    }
  }

  const units = collapseOuterUnits(nodes, loops, loopByNodeId, stableIndex);
  const outerEdges = collapseOuterEdges(forwardEdges, loopByNodeId);
  const outerOrder = stableTopologicalOrder(
    units.map((unit) => unit.id),
    outerEdges,
    new Map(units.map((unit) => [unit.id, unit.stableIndex])),
    "collapsed dynamic graph"
  );
  assertReachable(nodes, edges, units, outerEdges, loopByNodeId);

  const incoming = incomingEdges(edges.filter((edge) => edge.dispatchRole !== "loop_back"));
  const { counts } = collection;
  const steps = [];
  for (const unitId of outerOrder) {
    const unit = units.find((candidate) => candidate.id === unitId);
    if (!unit) throw new Error(`dynamic runnable internal plan error: missing outer unit ${unitId}.`);
    if (unit.loop) {
      steps.push(buildLoopStep(unit.loop, graph, incoming, excludedNodeIds, counts));
      continue;
    }
    const node = graph.nodesById.get(unit.nodeId);
    if (!node || handlerForNode(node).planRole === "seed" || excludedNodeIds.has(node.id)) continue;
    steps.push(...buildNodeSteps(node, graph, incoming, excludedNodeIds, counts, null));
  }
  assertPlanRuntimeIdentityUnique(nodes, graph, excludedNodeIds, counts);

  const seedNodeIds = new Set(nodes.filter((node) => handlerForNode(node).planRole === "seed").map((node) => node.id));
  const coverage = planCoverage(nodes, steps, excludedNodeIds, seedNodeIds);
  const expectedNodeIds = new Set(nodes.map((node) => node.id));
  const coveredNodeIds = new Set(coverage.keys());
  const uncovered = [...expectedNodeIds].filter((nodeId) => !coveredNodeIds.has(nodeId));
  const extra = [...coveredNodeIds].filter((nodeId) => !expectedNodeIds.has(nodeId));
  if (uncovered.length || extra.length) {
    throw new Error(
      `dynamic runnable internal coverage error: unconsumed nodes [${uncovered.join(", ")}], unexpected nodes [${extra.join(", ")}].`
    );
  }
  const expectedEdgeIds = new Set(edges.map((edge) => edge.key));
  const unconsumedEdges = [...expectedEdgeIds].filter((edgeId) => !consumedEdgeIds.has(edgeId));
  const unexpectedEdges = [...consumedEdgeIds].filter((edgeId) => !expectedEdgeIds.has(edgeId));
  if (unconsumedEdges.length || unexpectedEdges.length) {
    throw new Error(
      `dynamic runnable internal coverage error: unconsumed edges [${unconsumedEdges.join(", ")}], unexpected edges [${unexpectedEdges.join(", ")}].`
    );
  }

  const seeds = nodes.filter((node) => seedNodeIds.has(node.id)).map((node) => ({ nodeId: node.id }));
  const resultNodeId = [...steps].reverse().find((step) => step.kind === "terminal")?.nodeId;
  if (!resultNodeId) {
    throw new Error("dynamic runnable mode requires at least one reachable output terminal.");
  }
  return {
    seeds,
    steps,
    coverage,
    consumedEdgeIds: [...consumedEdgeIds],
    loopControls: collection.loopControlNodes,
    resultNodeId
  };
}

function normalizeNodes(graph) {
  const seen = new Set();
  const nodes = [];
  for (const [index, node] of graph.nodes.entries()) {
    if (!node || typeof node.id !== "string" || !node.id.trim()) {
      throw new Error(`dynamic runnable graph has a node without a non-empty id at index ${index}.`);
    }
    if (seen.has(node.id)) throw new Error(`dynamic runnable graph has duplicate node id ${node.id}.`);
    seen.add(node.id);
    if (typeof node.module_id === "string" && !graph.moduleById.has(node.module_id)) {
      throw new Error(`dynamic runnable node ${node.id} references missing module ${node.module_id}.`);
    }
    nodes.push(node);
  }
  if (!nodes.length) throw new Error("dynamic runnable mode did not find any Graph IR nodes.");
  return nodes;
}

function validateNodeSupport(collection) {
  const structuredHumanInputs = collection.unsupportedNodes.filter((entry) => entry.code === "structured_human_input");
  const badNodes = collection.unsupportedNodes
    .filter((entry) => entry.code !== "structured_human_input")
    .map((entry) => `${entry.node.id} (${entry.node.node_kind}: ${entry.reason})`);
  if (badNodes.length) {
    throw new Error(
      `dynamic runnable mode cannot lower these nodes yet: ${badNodes.join(", ")}. Supported dynamic roles are module-bound runs, input seeds, output terminals, human_input runs, join barriers, and loop_control nodes.`
    );
  }
  if (structuredHumanInputs.length) {
    throw new Error(
      `dynamic runnable mode cannot lower structured human_input response schemas yet: ${structuredHumanInputs.map((entry) => `${entry.node.id} (${entry.reason})`).join(", ")}. Use response_schema_ref "str".`
    );
  }
}

function normalizeEdges(context, collection) {
  const rawEdges = Array.isArray(context.processFlow.edges) ? context.processFlow.edges : [];
  const seenIds = new Set();
  return rawEdges.map((edge, index) => {
    if (edge && typeof edge.id === "string" && edge.id.trim()) {
      if (seenIds.has(edge.id)) throw new Error(`dynamic runnable graph has duplicate edge id ${edge.id}.`);
      seenIds.add(edge.id);
    }
    try {
      return validateAndLowerEdge(edge, {
        mode: "dynamic",
        graph: collection.graph,
        counts: collection.counts,
        exclusions: collection.toolsetAdapterIds,
        index
      });
    } catch (error) {
      throw new Error(`dynamic runnable mode does not support these edges yet: ${error.message}`);
    }
  });
}

function analyzeLoops(context, nodes, edges, stableIndex, consumedEdgeIds, controls) {
  const regions = (Array.isArray(context.processFlow.containers) ? context.processFlow.containers : []).filter(
    (container) => container?.container_kind === "loop_region"
  );
  const regionIds = new Set();
  for (const [index, region] of regions.entries()) {
    if (typeof region.id !== "string" || !region.id.trim()) {
      throw new Error(`dynamic runnable graph has a loop_region without a non-empty id at index ${index}.`);
    }
    if (regionIds.has(region.id)) throw new Error(`dynamic runnable graph has duplicate loop_region id ${region.id}.`);
    regionIds.add(region.id);
  }
  const pathEdges = edges.filter((edge) => edge.dispatchRole !== "loop_back" && edge.dispatchRole !== "loop_exit");
  const adjacency = adjacencyMap(pathEdges);
  const reverse = adjacencyMap(pathEdges.map((edge) => ({ from: edge.to, to: edge.from })));
  const loops = [];

  for (const controlNode of controls) {
    const anchors = regions.filter((region) => arrayOfIds(region.contains_node_ids).includes(controlNode.id));
    if (anchors.length !== 1) {
      throw new Error(
        `dynamic runnable mode cannot lower loop_control ${controlNode.id} unless it is anchored by exactly one loop_region container.`
      );
    }
    const region = anchors[0];
    const contained = new Set(arrayOfIds(region.contains_node_ids));
    const declaredAnchors = [...arrayOfIds(region.entry_node_ids), ...arrayOfIds(region.exit_node_ids), controlNode.id];
    const missingAnchors = declaredAnchors.filter((nodeId) => !contained.has(nodeId));
    if (missingAnchors.length) {
      throw new Error(`loop_region ${region.id} does not contain its reviewed entry/exit anchors: ${missingAnchors.join(", ")}.`);
    }
    const outgoing = edges.filter((edge) => edge.from === controlNode.id);
    const backEdges = outgoing.filter((edge) => edge.dispatchRole === "loop_back");
    const exitEdges = outgoing.filter((edge) => edge.dispatchRole === "loop_exit");
    if (!backEdges.length || !exitEdges.length) {
      throw new Error(`loop_control ${controlNode.id} requires both loop_back and loop_exit edges.`);
    }
    for (const edge of [...backEdges, ...exitEdges]) consumedEdgeIds.add(edge.key);
    if (outgoing.some((edge) => edge.dispatchRole !== "loop_back" && edge.dispatchRole !== "loop_exit")) {
      throw new Error(`loop_control ${controlNode.id} has an unsupported non-loop outgoing edge.`);
    }
    const backAliases = edgeAliases(backEdges, controlNode.id, "loop_back");
    const exitAliases = edgeAliases(exitEdges, controlNode.id, "loop_exit", { allowDefault: true });
    const canReachControl = reachableFrom([controlNode.id], reverse);
    const operational = new Set([controlNode.id]);
    for (const backEdge of backEdges) {
      const fromEntry = reachableFrom([backEdge.to], adjacency);
      const closure = [...fromEntry].filter((nodeId) => canReachControl.has(nodeId));
      if (!closure.includes(backEdge.to) || !closure.includes(controlNode.id)) {
        throw new Error(`loop_back edge ${backEdge.key} has no forward path from ${backEdge.to} to ${controlNode.id}.`);
      }
      for (const nodeId of closure) operational.add(nodeId);
    }
    const nestedControls = controls.filter((node) => node.id !== controlNode.id && operational.has(node.id));
    if (nestedControls.length) {
      throw new Error(
        `dynamic runnable mode does not support nested loop closures: ${controlNode.id} contains ${nestedControls.map((node) => node.id).join(", ")}.`
      );
    }
    const backTargets = new Set(backEdges.map((edge) => edge.to));
    const reviewedEntries = new Set(arrayOfIds(region.entry_node_ids));
    const unreviewedBackTargets = [...backTargets].filter((nodeId) => !reviewedEntries.has(nodeId));
    if (unreviewedBackTargets.length) {
      throw new Error(
        `loop_region ${region.id} must list loop_back targets as reviewed entry anchors: ${unreviewedBackTargets.join(", ")}.`
      );
    }
    if (!arrayOfIds(region.exit_node_ids).includes(controlNode.id)) {
      throw new Error(`loop_region ${region.id} must list ${controlNode.id} as its reviewed exit anchor.`);
    }
    const invalidExitTargets = exitEdges.map((edge) => edge.to).filter((nodeId) => operational.has(nodeId));
    if (invalidExitTargets.length) {
      throw new Error(`loop_control ${controlNode.id} has loop_exit targets inside its operational body: ${invalidExitTargets.join(", ")}.`);
    }
    const bodyOrder = stableTopologicalOrder(
      [...operational],
      pathEdges.filter((edge) => operational.has(edge.from) && operational.has(edge.to)),
      stableIndex,
      `loop_region ${region.id}`
    );
    if (bodyOrder.at(-1) !== controlNode.id) {
      throw new Error(`loop_region ${region.id} has an operational node without a forward path to ${controlNode.id}.`);
    }
    const bodyNodes = bodyOrder.slice(0, -1).map((nodeId) => nodes.find((node) => node.id === nodeId));
    if (!bodyNodes.length || bodyNodes.some((node) => !node)) {
      throw new Error(`loop_region ${region.id} has no lowerable operational body before ${controlNode.id}.`);
    }
    const defaultAction =
      humanInputDefaultAction(bodyNodes, backAliases, exitAliases, controlNode.id) ?? edgeDefaultAction(backEdges, exitEdges);
    loops.push({
      regionId: region.id,
      region,
      controlNode,
      operationalNodeIds: operational,
      bodyOrder: bodyOrder.slice(0, -1),
      backTargets,
      backAliases,
      exitAliases,
      defaultAction,
      exitTargetIds: exitEdges.map((edge) => edge.to)
    });
  }

  for (const region of regions) {
    const anchoredControls = controls.filter((control) => arrayOfIds(region.contains_node_ids).includes(control.id));
    if (anchoredControls.length !== 1) throw new Error(`loop_region ${region.id} requires exactly one loop_control node.`);
  }
  for (let leftIndex = 0; leftIndex < loops.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < loops.length; rightIndex += 1) {
      const left = loops[leftIndex];
      const right = loops[rightIndex];
      const overlap = [...left.operationalNodeIds].filter((nodeId) => right.operationalNodeIds.has(nodeId));
      if (overlap.length) {
        throw new Error(
          `dynamic runnable mode does not support overlapping loop closures: ${left.regionId} and ${right.regionId} share ${overlap.join(", ")}.`
        );
      }
    }
  }
  for (const loop of loops) {
    const allowedEntries = new Set([...arrayOfIds(loop.region.entry_node_ids), ...loop.backTargets]);
    for (const edge of pathEdges) {
      const fromInside = loop.operationalNodeIds.has(edge.from);
      const toInside = loop.operationalNodeIds.has(edge.to);
      if (!fromInside && toInside && !allowedEntries.has(edge.to)) {
        throw new Error(`loop_region ${loop.regionId} has an illegal mid-body entry edge ${edge.key} to ${edge.to}.`);
      }
      if (fromInside && !toInside) {
        throw new Error(`loop_region ${loop.regionId} has an illegal early-exit edge ${edge.key} from ${edge.from}.`);
      }
    }
  }
  return loops;
}

function collapseOuterUnits(nodes, loops, loopByNodeId, stableIndex) {
  const units = [];
  const seenLoops = new Set();
  for (const node of nodes) {
    const loop = loopByNodeId.get(node.id);
    if (loop) {
      if (!seenLoops.has(loop.regionId)) {
        const indexes = [...loop.operationalNodeIds].map((nodeId) => stableIndex.get(nodeId));
        units.push({ id: loopUnitId(loop), loop, stableIndex: Math.min(...indexes) });
        seenLoops.add(loop.regionId);
      }
      continue;
    }
    units.push({ id: node.id, nodeId: node.id, stableIndex: stableIndex.get(node.id) });
  }
  return units;
}

function collapseOuterEdges(edges, loopByNodeId) {
  const rows = [];
  const seen = new Set();
  for (const edge of edges) {
    const fromLoop = loopByNodeId.get(edge.from);
    const toLoop = loopByNodeId.get(edge.to);
    const from = fromLoop ? loopUnitId(fromLoop) : edge.from;
    const to = toLoop ? loopUnitId(toLoop) : edge.to;
    if (from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ from, to });
  }
  return rows;
}

function assertReachable(nodes, edges, units, outerEdges, loopByNodeId) {
  const seedUnits = nodes
    .filter((node) => handlerForNode(node).planRole === "seed")
    .map((node) => loopByNodeId.has(node.id) ? loopUnitId(loopByNodeId.get(node.id)) : node.id);
  if (!seedUnits.length) throw new Error("dynamic runnable mode requires at least one Graph IR input seed.");
  const reachableUnits = reachableFrom(seedUnits, adjacencyMap(outerEdges));
  const unitByNode = new Map();
  for (const unit of units) {
    if (unit.loop) {
      for (const nodeId of unit.loop.operationalNodeIds) unitByNode.set(nodeId, unit.id);
    } else {
      unitByNode.set(unit.nodeId, unit.id);
    }
  }
  const unreachable = nodes.filter((node) => !reachableUnits.has(unitByNode.get(node.id))).map((node) => node.id);
  if (unreachable.length) {
    throw new Error(`dynamic runnable mode rejects active nodes unreachable from Graph IR input seeds: ${unreachable.join(", ")}.`);
  }
  const reachableOutputs = nodes.filter(
    (node) => handlerForNode(node).planRole === "terminal" && reachableUnits.has(unitByNode.get(node.id))
  );
  if (!reachableOutputs.length) throw new Error("dynamic runnable mode requires at least one reachable output terminal.");

  const exitEdges = edges.filter((edge) => edge.dispatchRole === "loop_exit");
  for (const edge of exitEdges) {
    if (!loopByNodeId.has(edge.from)) {
      throw new Error(`loop_exit edge ${edge.key} is not owned by an operational loop closure.`);
    }
  }
}

function planCoverage(nodes, steps, excludedNodeIds, seedNodeIds) {
  const graphNodeIds = new Set(nodes.map((node) => node.id));
  const coverage = new Map();
  for (const node of nodes) {
    if (seedNodeIds.has(node.id)) coverage.set(node.id, "seed");
    else if (excludedNodeIds.has(node.id)) coverage.set(node.id, TOOLSET_EXCLUSION_ROLE);
  }
  const record = (step) => {
    if (step.kind === "loop") {
      for (const bodyStep of step.bodySteps) record(bodyStep);
      coverage.set(step.controlNodeId, "loop_control");
      return;
    }
    if ((step.kind === "join" && !step.explicit) || !graphNodeIds.has(step.nodeId)) return;
    if (coverage.has(step.nodeId)) {
      throw new Error(`dynamic runnable internal coverage error: node ${step.nodeId} has multiple execution roles.`);
    }
    coverage.set(step.nodeId, step.kind === "terminal" ? "terminal" : step.kind === "join" ? "join" : "run");
  };
  for (const step of steps) record(step);
  return new Map(nodes.filter((node) => coverage.has(node.id)).map((node) => [node.id, coverage.get(node.id)]));
}

function buildLoopStep(loop, graph, incoming, excludedNodeIds, counts) {
  const scope = loop.operationalNodeIds;
  assertLoopControlDecisionInputIsSingleStep(loop.controlNode, graph, incoming, excludedNodeIds, scope);
  const bodySteps = [];
  for (const nodeId of loop.bodyOrder) {
    const node = graph.nodesById.get(nodeId);
    if (!node || excludedNodeIds.has(nodeId)) continue;
    bodySteps.push(...buildNodeSteps(node, graph, incoming, excludedNodeIds, counts, scope, loop.backTargets));
  }
  const controlSteps = buildNodeSteps(loop.controlNode, graph, incoming, excludedNodeIds, counts, scope);
  const controlRun = controlSteps.at(-1);
  if (!controlRun || controlRun.kind !== "run") {
    throw new Error(`dynamic runnable internal plan error: loop_control ${loop.controlNode.id} did not lower to a run step.`);
  }
  bodySteps.push(...controlSteps.slice(0, -1));
  return {
    kind: "loop",
    nodeId: loop.controlNode.id,
    regionId: loop.regionId,
    entryNodeIds: [...loop.backTargets],
    bodySteps,
    controlNodeId: loop.controlNode.id,
    controlSymbol: controlRun.symbol,
    controlInputRefs: controlRun.inputRefs,
    controlRunId: controlRun.runId,
    backAliases: loop.backAliases,
    exitAliases: loop.exitAliases,
    defaultAction: loop.defaultAction,
    exitTargetIds: loop.exitTargetIds
  };
}

function assertLoopControlDecisionInputIsSingleStep(controlNode, graph, incoming, excludedNodeIds, loopScope) {
  const directEdges = (incoming.get(controlNode.id) ?? []).filter((edge) => !excludedNodeIds.has(edge.from));
  const refs = effectiveInputRefs(controlNode.id, incoming, excludedNodeIds, loopScope);
  const explicitJoinIds = refs
    .filter((ref) => {
      const predecessor = graph.nodesById.get(ref.nodeId);
      return predecessor && handlerForNode(predecessor).planRole === "join";
    })
    .map((ref) => ref.nodeId);
  const reviewedImplicitFanIn = refs.length > 1 && directEdges.length > 1 && directEdges.every(isReviewedFanIn);
  if (!explicitJoinIds.length && !reviewedImplicitFanIn) return;

  const source = explicitJoinIds.length
    ? `explicit join ${explicitJoinIds.join(", ")}`
    : "reviewed implicit fan-in";
  throw new Error(
    `dynamic runnable mode cannot lower loop_control ${controlNode.id} with a fan-in aggregate decision input from ${source}; add a reviewed single decision-producing step between the fan-in and loop_control ${controlNode.id}.`
  );
}

function buildNodeSteps(node, graph, incoming, excludedNodeIds, counts, loopScope, backTargets = new Set()) {
  const directEdges = incoming.get(node.id) ?? [];
  const nodeIndex = new Map(graph.nodes.map((candidate, index) => [candidate.id, index]));
  const refs = effectiveInputRefs(node.id, incoming, excludedNodeIds, loopScope).sort(
    (left, right) => compareStable(left.nodeId, right.nodeId, nodeIndex)
  );
  const nodeHandler = handlerForNode(node);
  if (nodeHandler.planRole === "join") {
    if (refs.length < 2) throw new Error(`dynamic explicit join ${node.id} requires at least two predecessors.`);
    return [joinStep(node.id, refs, graph, counts, true)];
  }

  const steps = [];
  let inputRefs = refs;
  if (refs.length > 1) {
    const fanInEdges = directEdges.filter((edge) => !excludedNodeIds.has(edge.from));
    const reviewedFanIn = fanInEdges.length > 1 && fanInEdges.every(isReviewedFanIn);
    if (!reviewedFanIn) {
      throw new Error(
        `dynamic runnable mode rejects ambiguous multiple normal predecessors for ${node.id}; add an explicit join or reviewed fan_in edges.`
      );
    }
    const barrierId = `__dynamic_fan_in__${node.id}`;
    steps.push(joinStep(barrierId, refs, graph, counts, false));
    inputRefs = [{ nodeId: barrierId, scope: loopScope ? "iteration" : "outer", storage: "barrier" }];
  }
  const symbol = resolveRuntimeEndpoint(node.id, {
    mode: "dynamic",
    side: "run",
    graph,
    counts,
    exclusions: excludedNodeIds
  });
  if (!symbol) throw new Error(`dynamic runnable internal plan error: no runtime symbol for ${node.id}.`);
  steps.push({
    kind: nodeHandler.planRole === "terminal" ? "terminal" : "run",
    nodeId: node.id,
    symbol,
    inputRefs,
    usesLoopFeedback: backTargets.has(node.id),
    runId: loopScope ? null : `run-node-${dynamicRunIdComponent(node.id)}`
  });
  return steps;
}

function joinStep(nodeId, refs, graph, counts, explicit) {
  const predecessors = refs.map((ref) => ({
    ...ref,
    runtimeName: resolveRuntimeName(graph.nodesById.get(ref.nodeId), { mode: "dynamic", graph, counts })
  }));
  const owners = new Map();
  for (const predecessor of predecessors) {
    if (owners.has(predecessor.runtimeName) && owners.get(predecessor.runtimeName) !== predecessor.nodeId) {
      throw new Error(
        `dynamic runnable mode rejects ambiguous join keys for ${nodeId}: ${owners.get(predecessor.runtimeName)} and ${predecessor.nodeId} both resolve to ${predecessor.runtimeName}.`
      );
    }
    owners.set(predecessor.runtimeName, predecessor.nodeId);
  }
  return {
    kind: "join",
    nodeId,
    explicit,
    predecessors
  };
}

function effectiveInputRefs(nodeId, incoming, excludedNodeIds, loopScope, visiting = new Set()) {
  if (visiting.has(nodeId)) throw new Error(`dynamic runnable internal predecessor cycle while resolving ${nodeId}.`);
  visiting.add(nodeId);
  const refs = [];
  for (const edge of incoming.get(nodeId) ?? []) {
    if (excludedNodeIds.has(edge.from)) {
      refs.push(...effectiveInputRefs(edge.from, incoming, excludedNodeIds, loopScope, visiting));
    } else {
      refs.push({ nodeId: edge.from, scope: loopScope?.has(edge.from) ? "iteration" : "outer" });
    }
  }
  visiting.delete(nodeId);
  const seen = new Set();
  return refs.filter((ref) => {
    const key = `${ref.scope}:${ref.nodeId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertPlanRuntimeIdentityUnique(nodes, graph, excludedNodeIds, counts) {
  const symbols = new Map();
  const runtimeNames = new Map();
  for (const node of nodes) {
    if (handlerForNode(node).planRole === "seed" || handlerForNode(node).planRole === "join" || excludedNodeIds.has(node.id)) continue;
    const symbol = resolveRuntimeEndpoint(node.id, {
      mode: "dynamic",
      side: "run",
      graph,
      counts,
      exclusions: excludedNodeIds
    });
    const runtimeName = resolveRuntimeName(node, { mode: "dynamic", graph, counts });
    assertIdentityOwner(symbols, symbol, node.id, "Python node symbol");
    assertIdentityOwner(runtimeNames, runtimeName, node.id, "ADK runtime node name");
  }
}

function assertIdentityOwner(owners, identity, nodeId, label) {
  if (owners.has(identity) && owners.get(identity) !== nodeId) {
    throw new Error(
      `dynamic runnable mode rejects ambiguous ${label}: ${owners.get(identity)} and ${nodeId} both resolve to ${identity}.`
    );
  }
  owners.set(identity, nodeId);
}

function stableTopologicalOrder(nodeIds, edges, stableIndex, label, consumedEdgeIds = null) {
  const ids = [...new Set(nodeIds)];
  const idSet = new Set(ids);
  const adjacency = new Map(ids.map((nodeId) => [nodeId, []]));
  const inDegree = new Map(ids.map((nodeId) => [nodeId, 0]));
  const seenEdges = new Set();
  for (const edge of edges) {
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue;
    if (consumedEdgeIds && typeof edge.key === "string") consumedEdgeIds.add(edge.key);
    const key = `${edge.from}->${edge.to}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    adjacency.get(edge.from).push(edge.to);
    inDegree.set(edge.to, inDegree.get(edge.to) + 1);
  }
  const ready = ids.filter((nodeId) => inDegree.get(nodeId) === 0).sort((left, right) => compareStable(left, right, stableIndex));
  const order = [];
  while (ready.length) {
    const nodeId = ready.shift();
    order.push(nodeId);
    for (const next of adjacency.get(nodeId)) {
      inDegree.set(next, inDegree.get(next) - 1);
      if (inDegree.get(next) === 0) {
        ready.push(next);
        ready.sort((left, right) => compareStable(left, right, stableIndex));
      }
    }
  }
  if (order.length !== ids.length) {
    const cycleIds = ids.filter((nodeId) => inDegree.get(nodeId) > 0);
    throw new Error(`dynamic runnable mode rejects a cycle in ${label}: ${cycleIds.join(", ")}.`);
  }
  return order;
}

function compareStable(left, right, stableIndex) {
  return (stableIndex.get(left) ?? Number.MAX_SAFE_INTEGER) - (stableIndex.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right);
}

function incomingEdges(edges) {
  const incoming = new Map();
  for (const edge of edges) {
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    incoming.get(edge.to).push(edge);
  }
  return incoming;
}

function adjacencyMap(edges) {
  const adjacency = new Map();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from).push(edge.to);
  }
  return adjacency;
}

function reachableFrom(seeds, adjacency) {
  const reached = new Set(seeds);
  const queue = [...seeds];
  while (queue.length) {
    const nodeId = queue.shift();
    for (const next of adjacency.get(nodeId) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function isReviewedFanIn(edge) {
  return edge.fanIn === true;
}

function loopUnitId(loop) {
  return `loop:${loop.regionId}`;
}

function edgeAliases(edges, controlNodeId, semantic, options = {}) {
  const aliases = [];
  for (const edge of edges) {
    const hasCondition = typeof edge.route_condition === "string" && edge.route_condition.trim();
    const hasAliases = Array.isArray(edge.route_aliases) && edge.route_aliases.some((alias) => typeof alias === "string" && alias.trim());
    if (!hasCondition && !hasAliases && !(options.allowDefault && edge.is_default_route === true)) {
      throw new Error(`loop_control ${controlNodeId} requires reviewed route_condition or route_aliases for ${semantic} edge ${edge.key}.`);
    }
    if (hasCondition) aliases.push(...routeAliases(routeValue(edge), edge));
    else aliases.push(...edge.route_aliases.map((alias) => alias.trim().toLowerCase()).filter(Boolean));
  }
  return [...new Set(aliases)];
}

function humanInputDefaultAction(bodyNodes, backAliases, exitAliases, controlNodeId) {
  const defaultChoices = bodyNodes
    .map((node) => node?.human_input_contract?.default_choice)
    .filter((choice) => typeof choice === "string" && choice.trim());
  for (const choice of defaultChoices) {
    const choiceAliases = routeAliases(choice);
    const matchesBack = choiceAliases.some((alias) => backAliases.includes(alias));
    const matchesExit = choiceAliases.some((alias) => exitAliases.includes(alias));
    if (matchesBack && matchesExit) throw new Error(`loop_control ${controlNodeId} has ambiguous human_input default_choice ${choice}.`);
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

function arrayOfIds(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
