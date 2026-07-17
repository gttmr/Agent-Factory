import assert from "node:assert/strict";
import test from "node:test";
import { collectGenerationNodes } from "../adk-source/graph/collector.mjs";
import { assertDynamicRunnableGraphSupported } from "../adk-source/graph/dynamic.mjs";
import { channelModules } from "./fixtures.mjs";

function mixedCollectionContext() {
  const { agentBase, connectedAdapter } = channelModules();
  const owner = {
    ...agentBase,
    id: "mod-owner",
    name: "Owner Agent",
    invoke_binding: "mcp_toolset",
    decision_owner: "llm",
    call_control: "selected_by_llm"
  };
  const toolset = { ...connectedAdapter, id: "mod-toolset", name: "Toolset Adapter" };
  const regular = { ...agentBase, id: "mod-regular", name: "Regular Agent" };
  const nodes = [
    { id: "input", node_kind: "input" },
    {
      id: "owner",
      node_kind: "agent",
      module_id: owner.id,
      invoke_binding: "mcp_toolset",
      decision_owner: "llm",
      call_control: "selected_by_llm"
    },
    { id: "toolset", node_kind: "adapter", module_id: toolset.id },
    { id: "regular", node_kind: "agent", module_id: regular.id },
    { id: "human", node_kind: "human_input" },
    { id: "router", node_kind: "router" },
    { id: "output", node_kind: "output" },
    { id: "join", node_kind: "join" },
    { id: "loop", node_kind: "loop_control" },
    { id: "callback", node_kind: "callback_wait" }
  ];
  return {
    modules: [owner, toolset, regular],
    processFlow: {
      nodes,
      edges: [
        { id: "edge-1", from: "input", to: "owner" },
        { id: "edge-2", from: "owner", to: "toolset" },
        { id: "edge-3", from: "owner", to: "regular" },
        { id: "edge-4", from: "regular", to: "output" }
      ],
      containers: []
    }
  };
}

test("common collector preserves declaration order and mode-specific toolset exclusions", () => {
  const context = mixedCollectionContext();
  const smoke = collectGenerationNodes(context, { mode: "smoke" });
  const statik = collectGenerationNodes(context, { mode: "static" });
  const dynamic = collectGenerationNodes(context, { mode: "dynamic" });

  assert.deepEqual(
    smoke.moduleSpecsInDeclarationOrder.map((spec) => spec.node.id),
    ["owner", "toolset", "regular"]
  );
  assert.deepEqual(
    statik.moduleSpecsInDeclarationOrder.map((spec) => spec.node.id),
    ["owner", "regular"]
  );
  assert.deepEqual(
    dynamic.moduleSpecsInDeclarationOrder.map((spec) => spec.node.id),
    ["owner", "regular"]
  );
  assert.deepEqual([...statik.toolsetAdapterIds], ["mod-toolset"]);
  assert.equal(statik.coverage.get("toolset"), "toolset_exclusion");
  assert.equal(dynamic.coverage.get("toolset"), "toolset_exclusion");
  assert.equal(smoke.coverage.get("toolset"), "module");
});

test("common collector accounts for every synthetic bucket, feature, and collision owner", () => {
  const context = mixedCollectionContext();
  const statik = collectGenerationNodes(context, { mode: "static" });
  const dynamic = collectGenerationNodes(context, { mode: "dynamic" });

  for (const collection of [statik, dynamic]) {
    assert.deepEqual(collection.humanInputNodes.map((node) => node.id), ["human"]);
    assert.deepEqual(collection.routerNodes.map((node) => node.id), ["router"]);
    assert.deepEqual(collection.terminalOutputNodes.map((node) => node.id), ["output"]);
    assert.deepEqual(collection.explicitJoinNodes.map((node) => node.id), ["join"]);
    assert.deepEqual(collection.loopControlNodes.map((node) => node.id), ["loop"]);
    assert.equal(collection.coverage.size, context.processFlow.nodes.length);
    assert.equal(collection.featureFlags.has("human_inputs"), true);
    assert.equal(collection.featureFlags.has("routes"), true);
    assert.equal(collection.featureFlags.has("terminal_outputs"), true);
    assert.equal(collection.featureFlags.has("loops"), true);
    assert.equal(collection.featureFlags.has("toolsets"), true);
  }

  const staticCollisionOwners = new Set(statik.collisionTargets.map((target) => target.owner));
  for (const owner of ["owner", "mod-owner", "regular", "mod-regular", "human", "router", "output", "join"]) {
    assert.equal(staticCollisionOwners.has(owner), true, owner);
  }
  const dynamicCollisionOwners = new Set(dynamic.collisionTargets.map((target) => target.owner));
  assert.equal(dynamicCollisionOwners.has("loop"), true);
  assert.equal(dynamicCollisionOwners.has("router"), false);
});

test("dynamic collection exposes routers before the dynamic guard rejects them", () => {
  const context = mixedCollectionContext();
  const collection = collectGenerationNodes(context, { mode: "dynamic" });
  assert.deepEqual(collection.routerNodes.map((node) => node.id), ["router"]);
  assert.ok(collection.unsupportedNodes.some((entry) => entry.node.id === "router" && /router lowerer/.test(entry.reason)));
  assert.throws(
    () => assertDynamicRunnableGraphSupported(context, { collection }),
    /cannot lower.*router.*conditional router lowerer/i
  );
});
