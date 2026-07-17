import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDynamicRunnablePlan, dynamicRunIdComponent } from "../adk-source/graph/dynamic.mjs";
import {
  channelModules,
  discoverGeneratedPackage,
  generateBundle,
  repoRoot,
  writeChannelFixture
} from "./fixtures.mjs";
import {
  executeGeneratedDynamicTrace
} from "./generated-python-runtime.mjs";

function fanInFixture() {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "Branch A" },
    { ...agentBase, id: "mod-b", name: "Branch B" },
    { ...agentBase, id: "mod-sink", name: "Sink" }
  ];
  const nodes = [
    { id: "in1", node_kind: "input" },
    { id: "join1", node_kind: "join" },
    { id: "sink", node_kind: "agent", module_id: "mod-sink" },
    { id: "b", node_kind: "agent", module_id: "mod-b" },
    { id: "a", node_kind: "agent", module_id: "mod-a" },
    { id: "out1", node_kind: "output" }
  ];
  const edges = [
    { id: "e-in-a", from: "in1", to: "a", execution_semantics: "fan_out" },
    { id: "e-in-b", from: "in1", to: "b", execution_semantics: "fan_out" },
    { id: "e-a-join", from: "a", to: "join1", execution_semantics: "fan_in" },
    { id: "e-b-join", from: "b", to: "join1", execution_semantics: "fan_in" },
    { id: "e-join-sink", from: "join1", to: "sink", execution_semantics: "normal_transition" },
    { id: "e-sink-out", from: "sink", to: "out1", execution_semantics: "normal_transition" }
  ];
  const containers = [
    {
      id: "dynamic-root",
      container_kind: "dynamic_workflow",
      contains_node_ids: nodes.map((node) => node.id),
      entry_node_ids: ["in1"],
      exit_node_ids: ["out1"]
    }
  ];
  return { modules, nodes, edges, containers };
}

test("dynamic plan follows edges and stable-ties independent siblings by original node index", () => {
  const fixture = fanInFixture();
  const plan = buildDynamicRunnablePlan({ modules: fixture.modules, processFlow: fixture });
  assert.deepEqual(
    plan.steps.map((step) => [step.kind, step.nodeId]),
    [
      ["run", "b"],
      ["run", "a"],
      ["join", "join1"],
      ["run", "sink"],
      ["terminal", "out1"]
    ]
  );
  assert.deepEqual([...plan.coverage.entries()], [
    ["in1", "seed"],
    ["join1", "join"],
    ["sink", "run"],
    ["b", "run"],
    ["a", "run"],
    ["out1", "terminal"]
  ]);
  assert.deepEqual(new Set(plan.consumedEdgeIds), new Set(fixture.edges.map((edge) => edge.id)));
});

test("generated dynamic fan-out shares input and joins by runtime node name", () => {
  const fixture = fanInFixture();
  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-dynamic-edge-order-"));
  try {
    writeChannelFixture(artifactRoot, fixture);
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const packageName = discoverGeneratedPackage(outputRoot);
    const result = executeGeneratedDynamicTrace({
      sourcePath: join(outputRoot, packageName, "agent.py"),
      initialInput: { request: "shared" },
      nodeOutputs: {
        agent_mod_b: { branch: "b" },
        agent_mod_a: { branch: "a" },
        agent_mod_sink: { merged: true },
        node_out1: { terminal: true }
      }
    });
    assert.deepEqual(result.trace.map((row) => row.symbol), ["agent_mod_b", "agent_mod_a", "agent_mod_sink", "node_out1"]);
    assert.deepEqual(result.trace[0].input, { request: "shared" });
    assert.deepEqual(result.trace[1].input, { request: "shared" });
    assert.deepEqual(result.trace[2].input, {
      Branch_B: { branch: "b" },
      Branch_A: { branch: "a" }
    });
    assert.deepEqual(result.trace.map((row) => row.run_id), [
      `run-node-${dynamicRunIdComponent("b")}`,
      `run-node-${dynamicRunIdComponent("a")}`,
      `run-node-${dynamicRunIdComponent("sink")}`,
      `run-node-${dynamicRunIdComponent("out1")}`
    ]);
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});

test("dynamic plan synthesizes only reviewed fan-in and rejects ambiguous normal convergence", () => {
  const reviewed = fanInFixture();
  reviewed.nodes = reviewed.nodes.filter((node) => node.id !== "join1");
  reviewed.edges = reviewed.edges.map((edge) => {
    if (edge.to === "join1") return { ...edge, to: "sink" };
    if (edge.from === "join1") return null;
    return edge;
  }).filter(Boolean);
  const plan = buildDynamicRunnablePlan({ modules: reviewed.modules, processFlow: reviewed });
  assert.deepEqual(plan.steps.map((step) => step.kind), ["run", "run", "join", "run", "terminal"]);
  assert.equal(plan.steps[2].explicit, false);

  const ambiguous = {
    ...reviewed,
    edges: reviewed.edges.map((edge) => edge.to === "sink" ? { ...edge, execution_semantics: "normal_transition" } : edge)
  };
  assert.throws(
    () => buildDynamicRunnablePlan({ modules: ambiguous.modules, processFlow: ambiguous }),
    /ambiguous multiple normal predecessors.*sink.*explicit join or reviewed fan_in/i
  );
});

test("dynamic coverage records agent-owned toolset exclusions without dropping incident dependencies", () => {
  const { agentBase, connectedAdapter } = channelModules();
  const agent = {
    ...agentBase,
    id: "mod-agent",
    name: "Agent",
    invoke_binding: "mcp_toolset",
    decision_owner: "llm",
    call_control: "selected_by_llm"
  };
  const toolset = { ...connectedAdapter, id: "mod-toolset", name: "Toolset" };
  const processFlow = {
    nodes: [
      { id: "in1", node_kind: "input" },
      {
        id: "agent",
        node_kind: "agent",
        module_id: "mod-agent",
        invoke_binding: "mcp_toolset",
        decision_owner: "llm",
        call_control: "selected_by_llm"
      },
      { id: "toolset", node_kind: "adapter", module_id: "mod-toolset" },
      { id: "out1", node_kind: "output" }
    ],
    edges: [
      { id: "e1", from: "in1", to: "agent" },
      { id: "e2", from: "agent", to: "toolset" },
      { id: "e3", from: "toolset", to: "out1" }
    ],
    containers: [{ id: "dynamic-root", container_kind: "dynamic_workflow" }]
  };
  const plan = buildDynamicRunnablePlan({ modules: [agent, toolset], processFlow });
  assert.equal(plan.coverage.get("toolset"), "toolset_exclusion");
  assert.deepEqual(plan.steps.map((step) => [step.kind, step.nodeId]), [
    ["run", "agent"],
    ["terminal", "out1"]
  ]);
  assert.deepEqual(plan.steps[1].inputRefs, [{ nodeId: "agent", scope: "outer" }]);
  assert.deepEqual(new Set(plan.consumedEdgeIds), new Set(["e1", "e2", "e3"]));
});

test("dynamic plan rejects explicit and reviewed implicit fan-in aggregates as loop_control decision input", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "Loop A" },
    { ...agentBase, id: "mod-b", name: "Loop B" }
  ];
  const nodes = [
    { id: "in1", node_kind: "input" },
    { id: "a", node_kind: "agent", module_id: "mod-a" },
    { id: "b", node_kind: "agent", module_id: "mod-b" },
    { id: "join1", node_kind: "join" },
    { id: "control", node_kind: "loop_control" },
    { id: "out1", node_kind: "output" }
  ];
  const edges = [
    { id: "e1", from: "in1", to: "a", execution_semantics: "fan_out" },
    { id: "e2", from: "in1", to: "b", execution_semantics: "fan_out" },
    { id: "e3", from: "a", to: "join1", execution_semantics: "fan_in" },
    { id: "e4", from: "b", to: "join1", execution_semantics: "fan_in" },
    { id: "e5", from: "join1", to: "control", execution_semantics: "normal_transition" },
    { id: "e6", from: "control", to: "a", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
    { id: "e7", from: "control", to: "b", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
    { id: "e8", from: "control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
  ];
  const containers = [
    { id: "loop", container_kind: "loop_region", contains_node_ids: ["a", "b", "join1", "control"], entry_node_ids: ["a", "b"], exit_node_ids: ["control"] }
  ];
  assert.throws(
    () => buildDynamicRunnablePlan({ modules, processFlow: { nodes, edges, containers } }),
    /loop_control control.*fan-in aggregate.*single decision-producing step/i
  );

  const implicitNodes = nodes.filter((node) => node.id !== "join1");
  const implicitEdges = edges
    .map((edge) => {
      if (edge.to === "join1") return { ...edge, to: "control" };
      if (edge.from === "join1") return null;
      return edge;
    })
    .filter(Boolean);
  const implicitContainers = containers.map((container) => ({
    ...container,
    contains_node_ids: container.contains_node_ids.filter((nodeId) => nodeId !== "join1")
  }));
  assert.throws(
    () => buildDynamicRunnablePlan({
      modules,
      processFlow: { nodes: implicitNodes, edges: implicitEdges, containers: implicitContainers }
    }),
    /loop_control control.*fan-in aggregate.*reviewed implicit fan-in.*single decision-producing step/i
  );
});

test("dynamic loop accepts a reviewed decision step between fan-in and loop_control", () => {
  const { agentBase } = channelModules();
  const modules = [
    { ...agentBase, id: "mod-a", name: "Loop A" },
    { ...agentBase, id: "mod-b", name: "Loop B" },
    { ...agentBase, id: "mod-decision", name: "Loop Decision" }
  ];
  const nodes = [
    { id: "in1", node_kind: "input" },
    { id: "a", node_kind: "agent", module_id: "mod-a" },
    { id: "b", node_kind: "agent", module_id: "mod-b" },
    { id: "join1", node_kind: "join" },
    { id: "decision", node_kind: "agent", module_id: "mod-decision" },
    { id: "control", node_kind: "loop_control" },
    { id: "out1", node_kind: "output" }
  ];
  const edges = [
    { id: "e1", from: "in1", to: "a", execution_semantics: "fan_out" },
    { id: "e2", from: "in1", to: "b", execution_semantics: "fan_out" },
    { id: "e3", from: "a", to: "join1", execution_semantics: "fan_in" },
    { id: "e4", from: "b", to: "join1", execution_semantics: "fan_in" },
    { id: "e5", from: "join1", to: "decision", execution_semantics: "normal_transition" },
    { id: "e6", from: "decision", to: "control", execution_semantics: "normal_transition" },
    { id: "e7", from: "control", to: "a", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
    { id: "e8", from: "control", to: "b", edge_kind: "control", execution_semantics: "loop_back", route_aliases: ["retry"] },
    { id: "e9", from: "control", to: "out1", edge_kind: "control", execution_semantics: "loop_exit", route_aliases: ["done"], is_default_route: true }
  ];
  const containers = [
    {
      id: "loop",
      container_kind: "loop_region",
      contains_node_ids: ["a", "b", "join1", "decision", "control"],
      entry_node_ids: ["a", "b"],
      exit_node_ids: ["control"]
    }
  ];
  const plan = buildDynamicRunnablePlan({ modules, processFlow: { nodes, edges, containers } });
  const loop = plan.steps.find((step) => step.kind === "loop");
  assert.ok(loop);
  assert.deepEqual(loop.bodySteps.map((step) => [step.kind, step.nodeId]), [
    ["run", "a"],
    ["run", "b"],
    ["join", "join1"],
    ["run", "decision"]
  ]);
  assert.deepEqual(loop.controlInputRefs, [{ nodeId: "decision", scope: "iteration" }]);

  const artifactRoot = mkdtempSync(join(tmpdir(), "af-gen-dynamic-loop-decision-"));
  try {
    writeChannelFixture(artifactRoot, { modules, nodes, edges, containers });
    const outputRoot = join(artifactRoot, "out");
    generateBundle(artifactRoot, outputRoot);
    const sourcePath = join(outputRoot, discoverGeneratedPackage(outputRoot), "agent.py");
    const result = executeGeneratedDynamicTrace({
      sourcePath,
      initialInput: { request: "loop" },
      nodeOutputs: {
        agent_mod_a: [{ iteration: 0, branch: "a" }, { iteration: 1, branch: "a" }],
        agent_mod_b: [{ iteration: 0, branch: "b" }, { iteration: 1, branch: "b" }],
        agent_mod_decision: [{ decision: "retry" }, { decision: "done" }],
        node_out1: { terminal: true }
      },
      passthroughSymbols: ["node_control"]
    });
    const controls = result.trace.filter((row) => row.symbol === "node_control");
    assert.deepEqual(controls.map((row) => row.input), [{ decision: "retry" }, { decision: "done" }]);
    assert.deepEqual(controls.map((row) => row.run_id), [
      `run-loop-${dynamicRunIdComponent("loop")}-iteration-0-${dynamicRunIdComponent("control")}`,
      `run-loop-${dynamicRunIdComponent("loop")}-iteration-1-${dynamicRunIdComponent("control")}`
    ]);
    assert.deepEqual(result.trace.at(-1).input, { decision: "done" });
  } finally {
    rmSync(artifactRoot, { recursive: true, force: true });
  }
});
