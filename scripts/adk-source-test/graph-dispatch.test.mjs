import assert from "node:assert/strict";
import test from "node:test";
import { graphEdgeKinds, graphNodeKinds } from "../artifact-validation/constants.mjs";
import {
  EDGE_KIND_HANDLERS,
  NODE_KIND_HANDLERS,
  edgeCapability,
  nodeCapability,
  resolveRuntimeEndpoint,
  validateAndLowerEdge
} from "../adk-source/dispatch/index.mjs";
import { GENERATION_MODES } from "../adk-source/dispatch/modes.mjs";
import { collectGenerationNodes } from "../adk-source/graph/collector.mjs";
import { graphIndexes, moduleNodeCounts, moduleNodeSpec } from "../adk-source/graph/indexes.mjs";
import { nodeFunctionName, nodeSymbol, syntheticNodeSymbol } from "../adk-source/naming.mjs";
import { channelModules, remoteModule } from "./fixtures.mjs";

test("dispatch registries are complete and own one handler per schema node/edge kind", () => {
  assert.deepEqual(new Set(Object.keys(NODE_KIND_HANDLERS)), graphNodeKinds);
  assert.deepEqual(new Set(Object.keys(EDGE_KIND_HANDLERS)), graphEdgeKinds);
  assert.equal(new Set(Object.values(NODE_KIND_HANDLERS)).size, graphNodeKinds.size);
  assert.equal(new Set(Object.values(EDGE_KIND_HANDLERS)).size, graphEdgeKinds.size);
});

test("every node handler reports truthful mode capability and a collection/lowering owner", () => {
  const { agentBase } = channelModules();
  for (const [kind, handler] of Object.entries(NODE_KIND_HANDLERS)) {
    const module = handler.moduleBinding === "required" ? { ...agentBase, id: `mod-${kind}` } : null;
    const node = { id: `node-${kind}`, node_kind: kind, ...(module ? { module_id: module.id } : {}) };
    const context = { modules: module ? [module] : [], processFlow: { nodes: [node], edges: [] } };
    const graph = graphIndexes(context);
    const counts = moduleNodeCounts(graph);
    for (const mode of GENERATION_MODES) {
      const capability = nodeCapability(node, { mode, graph, counts });
      const collection = collectGenerationNodes(context, { mode });
      if (capability.supported) {
        assert.equal(collection.coverage.get(node.id), handler.collectionRole, `${kind}/${mode}`);
        const collected = handler.collectionBucket
          ? collection[handler.collectionBucket].some((target) => (target.node ?? target).id === node.id)
          : false;
        const side = endpointSide(kind, mode);
        const endpoint = side
          ? resolveRuntimeEndpoint(node.id, { mode, side, graph, counts, exclusions: new Set() })
          : null;
        assert.ok(collected || endpoint || handler.planRole, `${kind}/${mode} has no collection/endpoint/plan result`);
      } else {
        assert.equal(typeof capability.reason, "string", `${kind}/${mode}`);
        assert.ok(capability.reason.trim(), `${kind}/${mode}`);
        const rejected = collection.unsupportedNodes.find((entry) => entry.node.id === node.id);
        assert.equal(rejected?.reason, capability.reason, `${kind}/${mode}`);
      }
    }
  }

  const router = { id: "router", node_kind: "router" };
  const graph = graphIndexes({ modules: [], processFlow: { nodes: [router], edges: [] } });
  const capability = nodeCapability(router, { mode: "dynamic", graph, counts: moduleNodeCounts(graph) });
  assert.equal(capability.supported, false);
  assert.match(capability.reason, /conditional router lowerer/);
});

test("central node endpoints preserve smoke/static/dynamic resolver parity", () => {
  const { agentBase } = channelModules();
  const module = { ...agentBase, id: "mod-a", name: "Agent A" };
  const nodes = [
    { id: "in", node_kind: "input" },
    { id: "agent", node_kind: "agent", module_id: module.id },
    { id: "human", node_kind: "human_input" },
    { id: "join", node_kind: "join" },
    { id: "router", node_kind: "router" },
    { id: "loop", node_kind: "loop_control" },
    { id: "out", node_kind: "output" }
  ];
  const graph = graphIndexes({ modules: [module], processFlow: { nodes, edges: [] } });
  const counts = moduleNodeCounts(graph);
  const spec = moduleNodeSpec(nodes[1], graph, counts);
  const endpoint = (nodeId, mode, side) =>
    resolveRuntimeEndpoint(nodeId, { mode, side, graph, counts, exclusions: new Set() });

  assert.equal(endpoint("in", "smoke", "from"), "START");
  assert.equal(endpoint("in", "static", "from"), "START");
  assert.equal(endpoint("agent", "smoke", "from"), nodeFunctionName(spec));
  assert.equal(endpoint("agent", "static", "to"), nodeSymbol(spec));
  assert.equal(endpoint("agent", "dynamic", "run"), nodeSymbol(spec));
  assert.equal(endpoint("human", "static", "from"), syntheticNodeSymbol(nodes[2]));
  assert.equal(endpoint("human", "dynamic", "run"), syntheticNodeSymbol(nodes[2]));
  assert.equal(endpoint("join", "static", "to"), syntheticNodeSymbol(nodes[3]));
  assert.equal(endpoint("join", "dynamic", "run"), null);
  assert.equal(endpoint("router", "static", "from"), syntheticNodeSymbol(nodes[4]));
  assert.equal(endpoint("router", "dynamic", "run"), null);
  assert.equal(endpoint("loop", "dynamic", "run"), syntheticNodeSymbol(nodes[5]));
  assert.equal(endpoint("out", "smoke", "to"), "emit_workflow_result");
  assert.equal(endpoint("out", "static", "to"), syntheticNodeSymbol(nodes[6]));
  assert.equal(endpoint("out", "dynamic", "run"), syntheticNodeSymbol(nodes[6]));
});

test("every accepted edge kind lowers once with an explicit consumed-edge record", () => {
  const { agentBase } = channelModules();
  const agent = { ...agentBase, id: "mod-a", name: "Agent A" };
  const remote = remoteModule({ id: "mod-r" });
  const nodes = [
    { id: "in", node_kind: "input" },
    { id: "agent", node_kind: "agent", module_id: agent.id },
    { id: "router", node_kind: "router" },
    { id: "loop", node_kind: "loop_control" },
    { id: "remote", node_kind: "remote_a2a", module_id: remote.id },
    { id: "out", node_kind: "output" }
  ];
  const graph = graphIndexes({ modules: [agent, remote], processFlow: { nodes, edges: [] } });
  const counts = moduleNodeCounts(graph);
  const consumed = [];
  let accepted = 0;
  for (const kind of Object.keys(EDGE_KIND_HANDLERS)) {
    for (const mode of GENERATION_MODES) {
      const edge = {
        id: `edge-${kind}-${mode}`,
        edge_kind: kind,
        execution_semantics: "normal_transition",
        ...edgeFields(kind, mode)
      };
      const dispatch = edgeCapability(edge, { mode, graph, counts });
      if (!dispatch.capability.supported) {
        assert.equal(typeof dispatch.capability.reason, "string", `${kind}/${mode}`);
        assert.ok(dispatch.capability.reason.trim(), `${kind}/${mode}`);
        continue;
      }
      const record = validateAndLowerEdge(edge, { mode, graph, counts });
      assert.equal(record.consumedEdgeId, edge.id, `${kind}/${mode}`);
      consumed.push(record.consumedEdgeId);
      accepted += 1;
    }
  }
  assert.equal(consumed.length, accepted);
  assert.equal(new Set(consumed).size, accepted);
});

function endpointSide(kind, mode) {
  if (kind === "input") return mode === "dynamic" ? null : "from";
  if (kind === "output") return mode === "dynamic" ? "run" : "to";
  if (kind === "join" || kind === "router") return mode === "static" ? "to" : null;
  if (kind === "loop_control") return mode === "dynamic" ? "run" : null;
  if (kind === "human_input") return mode === "static" ? "to" : "run";
  return mode === "smoke" ? "from" : mode === "static" ? "to" : "run";
}

function edgeFields(kind, mode) {
  if (["session_state", "temp_state", "user_state", "app_state"].includes(kind)) {
    return { from: "in", to: "agent", state_key: `${kind}_value` };
  }
  if (kind === "artifact") return { from: "in", to: "agent", artifact_key: "artifact.json" };
  if (kind === "route") {
    return {
      from: mode === "smoke" ? "in" : "router",
      to: "agent",
      execution_semantics: "conditional",
      route_condition: "choice == proceed"
    };
  }
  if (kind === "control" && mode === "dynamic") {
    return {
      from: "loop",
      to: "agent",
      execution_semantics: "loop_back",
      route_aliases: ["retry"]
    };
  }
  if (kind === "remote_a2a") {
    return {
      from: "agent",
      to: "remote",
      execution_semantics: "boundary_crossing",
      is_remote_boundary_crossing: true,
      a2a_contract_id: "a2a-001"
    };
  }
  return { from: "in", to: "agent" };
}
