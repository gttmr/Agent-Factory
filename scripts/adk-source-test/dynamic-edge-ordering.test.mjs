import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildDynamicRunnablePlan, dynamicRunIdComponent } from "../adk-source/graph/dynamic.mjs";
import {
  channelModules,
  discoverGeneratedPackage,
  generate,
  generateBundle,
  repoRoot,
  writeChannelFixture
} from "./fixtures.mjs";
import {
  assertBundleSha256Manifest,
  executeGeneratedDynamicTrace
} from "./generated-python-runtime.mjs";

const SMOKE_BASELINE = [
  ["af_adk_a2a_server.py", "7b99703b21959b971c1a7365bd884698e7e8e3043605757bdd3907450d3428c0"],
  ["implementation-handoff.md", "8c36f45b67e145be9641b8582a72e1d52848e43658c5836da0babe68d8f7da4f"],
  // README.md and req_gen_test_adk/README.md are excluded: they embed the
  // environment-dependent relative path back to the checkout's
  // .agent-factory/runtime.env, so their bytes vary by checkout/tmp location.
  // README stability is covered by the behavioral README tests instead.
  ["req_gen_test_adk/__init__.py", "5ab8550f1e4ff205f461d035caad57bd7d4535bdd19f9c804d747f29f20953f1"],
  ["req_gen_test_adk/agent.json", "f4b8a28fc20cda7d7132dd26fbea75ade12a405fdf9e626c1eb29fac5488ecff"],
  ["req_gen_test_adk/agent.py", "26e21298b7d209dff08633ebba3e7f35546ed51bff55e56a9fd262a9fb3fe5b8"],
  ["req_gen_test_adk/mock_config.yaml", "9a56f996e0b3795b1e495051cf0406f5eac9077e26959fe48bff2a917cad4902"],
  ["req_gen_test_adk/nodes/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/nodes/adapters.py", "3bdbe9a01560955a25562fcd4556cb64bf02126d4947ceb593ae61d060af08e1"],
  ["req_gen_test_adk/nodes/agents.py", "a3912eb74456113a75a7c8fb3949ce9354e718af3fa4329b595017e651eae115"],
  ["req_gen_test_adk/nodes/gates.py", "0087b918f4b6aecf805014df060119c6b5d0f86fd5ac9ffe7a88b2dd7b6e5aad"],
  ["req_gen_test_adk/nodes/human_inputs.py", "85b80e0cc7f0aa36be8e7b2407459126d17d281f6df6baafc380229fb7de2677"],
  ["req_gen_test_adk/nodes/routers.py", "16c6bf552636e110b48b6f89e0a54d48a80d8ac5ecd9a5632ebd156e1b1d1dbe"],
  ["req_gen_test_adk/nodes/workflow_calls.py", "8395fab4e022dd7cce56c6e699f0f6b29a1e059d2eb9dc88a14bd91be0e2fad8"],
  ["req_gen_test_adk/sample_inputs.yaml", "af8bc165f14a5bab73642d48ae637d24dfa1c7d85b1b210f50a4ca9b8e9ff60a"],
  ["req_gen_test_adk/schemas.py", "28cda704fddf55339abf9df31f520647a4448ec3ef0a36b79123b613d897308e"],
  ["req_gen_test_adk/tests/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/tests/test_workflow_contract.py", "32b8ab251bbe6ee095cc68a0cea2b06175867c3db15c2950135cf12436dbc7f3"],
  ["req_gen_test_adk/workflow_manifest.json", "74c18ce0df430e4ea087cc0d9756e5f70f777c3cbb13fe41bb9e51d7df4369ed"],
  ["req_gen_test_adk/workflow.py", "70378ae7aa04203f3ce87a5b671f820509aaae2eb2293cce99ad44b2c6910704"],
  ["runtime-chat-smoke.json", "6fa96345c0a4b4b24ac8140bec4a4aa7659db97b5c6bbf343257b0efcb3f7775"],
  ["scaffold-plan.json", "0aab24f36fe013b72672b7d46e9e1db6b8f76748934743c439517b3f2958b8d7"]
].map(([path, sha256]) => ({ path, sha256 }));

const STATIC_RUNNABLE_BASELINE = [
  [".env.example", "2aba4cb829bbc08355f2fdf4cf252d21bc20b4cc1fa9099c2ee45e52480547f4"],
  [".gitignore", "52a9121ac2c9f227e8faa7f74af1d8bdd96302521cd708f986ac4fe574bcf7d9"],
  ["af_adk_a2a_server.py", "7b99703b21959b971c1a7365bd884698e7e8e3043605757bdd3907450d3428c0"],
  ["agents.config.yaml", "0b6894d00eb13baeda3b30c19fc01fa0b3f43fa25e0c347839530952b6d7696c"],
  ["implementation-handoff.md", "638273a607f57d6a5a02e0462e97628e7dfdab8c0bfbee289d1d8c9d7b2bae2b"],
  // README.md and req_gen_test_adk/README.md are excluded: they embed the
  // environment-dependent relative path back to the checkout's
  // .agent-factory/runtime.env, so their bytes vary by checkout/tmp location.
  // README stability is covered by the behavioral README tests instead.
  ["req_gen_test_adk/__init__.py", "5ab8550f1e4ff205f461d035caad57bd7d4535bdd19f9c804d747f29f20953f1"],
  ["req_gen_test_adk/agent.json", "f4b8a28fc20cda7d7132dd26fbea75ade12a405fdf9e626c1eb29fac5488ecff"],
  // agent.py hash updated 2026-07-12: terminal-output emitter now binds the
  // node id via a python literal (_node_id) instead of raw f-string
  // interpolation (injection fix); smoke agent.py is unaffected.
  ["req_gen_test_adk/agent.py", "f3ed9bf59989a9fd698d49b31a6b059f02e9996e8739533fc80caacfcae8609e"],
  ["req_gen_test_adk/mock_config.yaml", "9a56f996e0b3795b1e495051cf0406f5eac9077e26959fe48bff2a917cad4902"],
  ["req_gen_test_adk/nodes/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/nodes/adapters.py", "3bdbe9a01560955a25562fcd4556cb64bf02126d4947ceb593ae61d060af08e1"],
  ["req_gen_test_adk/nodes/agents.py", "a3912eb74456113a75a7c8fb3949ce9354e718af3fa4329b595017e651eae115"],
  ["req_gen_test_adk/nodes/gates.py", "0087b918f4b6aecf805014df060119c6b5d0f86fd5ac9ffe7a88b2dd7b6e5aad"],
  ["req_gen_test_adk/nodes/human_inputs.py", "85b80e0cc7f0aa36be8e7b2407459126d17d281f6df6baafc380229fb7de2677"],
  ["req_gen_test_adk/nodes/routers.py", "16c6bf552636e110b48b6f89e0a54d48a80d8ac5ecd9a5632ebd156e1b1d1dbe"],
  ["req_gen_test_adk/nodes/workflow_calls.py", "8395fab4e022dd7cce56c6e699f0f6b29a1e059d2eb9dc88a14bd91be0e2fad8"],
  ["req_gen_test_adk/sample_inputs.yaml", "af8bc165f14a5bab73642d48ae637d24dfa1c7d85b1b210f50a4ca9b8e9ff60a"],
  ["req_gen_test_adk/schemas.py", "28cda704fddf55339abf9df31f520647a4448ec3ef0a36b79123b613d897308e"],
  ["req_gen_test_adk/tests/__init__.py", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["req_gen_test_adk/tests/test_workflow_contract.py", "ebcf6869ded821ed386eafb4bfea54de9ff12a52bc7d8e35338e876481f5b347"],
  ["req_gen_test_adk/workflow_manifest.json", "7e3ca0cff2b796f75d5511c11121b0493921003cddeaf93afb760d8d5c4738f3"],
  ["req_gen_test_adk/workflow.py", "70378ae7aa04203f3ce87a5b671f820509aaae2eb2293cce99ad44b2c6910704"],
  ["runtime-chat-smoke.json", "fb74638bb8cb017786be6ceebd552e90cf383816a239568fcfe579d1dc6d728f"],
  ["scaffold-plan.json", "e45c12a77645806ab0014447d04b47223551f4a25e0626d5fc87e361cd4bc3df"]
].map(([path, sha256]) => ({ path, sha256 }));

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

test("PR-A keeps canonical smoke and static runnable bundles byte-identical", () => {
  for (const [runnable, baseline] of [
    [false, SMOKE_BASELINE],
    [true, STATIC_RUNNABLE_BASELINE]
  ]) {
    const originalCwd = process.cwd();
    process.chdir(repoRoot);
    let generated;
    try {
      generated = generate({ runnable });
      assertBundleSha256Manifest(generated.outputRoot, baseline);
    } finally {
      if (generated) rmSync(generated.artifactRoot, { recursive: true, force: true });
      process.chdir(originalCwd);
    }
  }
});

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
