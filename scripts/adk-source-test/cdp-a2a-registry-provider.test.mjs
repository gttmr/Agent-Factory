import assert from "node:assert/strict";
import test from "node:test";
import { approvedRegistryA2AContract, generateRegistryBundle } from "./cdp-a2a-fixtures.mjs";
import { remoteModule } from "./fixtures.mjs";
import { compileGeneratedPython, executeGeneratedPythonSymbols } from "./generated-python-runtime.mjs";

function executeRegistryFixture(options) {
  const generated = generateRegistryBundle(options);
  try {
    compileGeneratedPython(generated.sourcePath);
    return executeGeneratedPythonSymbols({
      sourcePath: generated.sourcePath,
      names: ["_fn_mod_registry_discovery"],
      prelude: `
import asyncio
from typing import Any

class State(dict):
    def to_dict(self):
        return dict(self)

class Context:
    def __init__(self):
        self.state = State()

COMPONENT_CONTRACTS = {
    "mod-registry-discovery": {
        "developer_todos": [],
        "runtime_mock": None,
    }
}
`,
      body: `
ctx = Context()
payload = asyncio.run(_fn_mod_registry_discovery(ctx, {"request": "test"}))
result = {"payload": payload, "state": dict(ctx.state)}
`
    });
  } finally {
    generated.cleanup();
  }
}

test("Given approved Remote A2A contract When registry snapshot rows are projected Then reviewed provider fields are preserved", async () => {
  const { remoteA2aRegistrySnapshotRows } = await import("../adk-source/remote-a2a.mjs");
  const rows = remoteA2aRegistrySnapshotRows({
    analysisResult: { a2aContracts: [approvedRegistryA2AContract()] },
    modules: [
      remoteModule({
        id: "mod-reviewed-remote-agent",
        name: "reviewed_remote_agent",
        a2a_contract_id: "a2a-registry-001"
      })
    ]
  });

  assert.deepEqual(rows, [
    {
      module_id: "mod-reviewed-remote-agent",
      contract_id: "a2a-registry-001",
      target_agent_name: "Reviewed Remote Agent",
      agent_card_url: "http://127.0.0.1:8011/a2a/reviewed/.well-known/agent-card.json",
      rpc_url: "http://127.0.0.1:8011/a2a/reviewed",
      skills: ["chat.delegate", "task.lifecycle.observe"],
      operations: ["SendMessage", "GetTask", "CancelTask"],
      task_states: ["TASK_STATE_SUBMITTED", "TASK_STATE_WORKING", "TASK_STATE_INPUT_REQUIRED", "TASK_STATE_COMPLETED"],
      connection_status: "configured"
    }
  ]);
});

test("Given registry adapter and approved Remote A2A provider When runnable bundle is generated Then state snapshot contains configured provider row", () => {
  const result = executeRegistryFixture({ includeProvider: true });
  assert.equal(result.payload.connection_status, "configured");
  assert.equal(result.payload.status, "configured_remote_a2a_providers");
  assert.equal(result.payload.provider_count, 1);
  assert.equal(result.payload.providers[0].agent_card_url, "http://127.0.0.1:8011/a2a/reviewed/.well-known/agent-card.json");
  assert.deepEqual(result.state.agent_registry_snapshot, result.payload);
});

test("Given no approved Remote A2A provider When registry adapter is generated Then safe unconnected placeholder remains", () => {
  const result = executeRegistryFixture({ includeProvider: false });
  assert.equal(result.payload.connection_status, "unconnected");
  assert.equal(result.payload.providers, undefined);
  assert.deepEqual(result.state.agent_registry_snapshot, result.payload);
});

test("Given registry-shaped names without the reviewed selector When generated Then generic placeholder remains", () => {
  const result = executeRegistryFixture({ includeProvider: true, includeSelector: false });
  assert.equal(result.payload.connection_status, "unconnected");
  assert.equal(result.payload.providers, undefined);
  assert.deepEqual(result.state.agent_registry_snapshot, result.payload);
});

test("Given an incompatible registry selector module When generation starts Then every incompatibility is reported", () => {
  assert.throws(
    () =>
      generateRegistryBundle({
        includeProvider: true,
        moduleOverrides: {
          module_category: "workflow",
          runtime_binding: "mcp_tool",
          invoke_binding: "mcp_tool"
        }
      }),
    (error) => {
      assert.match(error.message, /module category must be adapter/);
      assert.match(error.message, /runtime_binding must be local_function/);
      assert.match(error.message, /invoke_binding must be local_function or local_python/);
      return true;
    }
  );
});

test("Given incompatible Graph IR registry bindings When generation starts Then every Graph incompatibility is reported", () => {
  assert.throws(
    () =>
      generateRegistryBundle({
        includeProvider: true,
        graphNodeOverrides: {
          runtime_binding: "direct_api",
          invoke_binding: "direct_api",
          adk_skeleton_contract: { generation_mode: "manual" }
        }
      }),
    (error) => {
      assert.match(error.message, /runtime_binding must be local_function/);
      assert.match(error.message, /invoke_binding must be local_function or local_python/);
      assert.match(error.message, /generation_mode must be deterministic_template when present/);
      return true;
    }
  );
});

test("Given a Graph IR-only registry selector When generation starts Then lost specialization is rejected", () => {
  assert.throws(
    () => generateRegistryBundle({ includeProvider: true, includeGraphSelector: true, includeScaffoldSelector: false }),
    /Graph IR selector .* is not preserved in scaffold module/
  );
});

test("Given a scaffold-only registry selector When generation starts Then unapproved specialization is rejected", () => {
  assert.throws(
    () => generateRegistryBundle({ includeProvider: true, includeGraphSelector: false, includeScaffoldSelector: true }),
    /scaffold selector .* has no matching Graph IR approval/
  );
});

test("Given a registry-selector Graph IR node without a scaffold module When generation starts Then lost specialization is rejected", () => {
  assert.throws(
    () => generateRegistryBundle({ includeProvider: true, includeScaffoldModule: false }),
    /Graph IR selector .* for module .* has no matching scaffold module/
  );
});

test("Given a registry-selector scaffold module without a Graph IR node When generation starts Then unapproved specialization is rejected", () => {
  assert.throws(
    () => generateRegistryBundle({ includeProvider: true, includeGraphNode: false }),
    /scaffold selector .* for module .* has no matching Graph IR node/
  );
});

test("Given a non-registry Graph IR template without a scaffold counterpart When generation starts Then agreement permits the derived plan", () => {
  const generated = generateRegistryBundle({
    includeProvider: false,
    includeGraphSelector: true,
    includeScaffoldSelector: false,
    graphNodeOverrides: {
      adk_skeleton_contract: { implementation_template: "function_stub" }
    }
  });
  generated.cleanup();
});

test("Given a derived scaffold template without a Graph IR counterpart When generation starts Then agreement permits the derived plan", () => {
  const generated = generateRegistryBundle({
    includeProvider: false,
    includeGraphSelector: false,
    includeScaffoldSelector: false,
    moduleOverrides: {
      adk_skeleton_contract: {
        scaffold_level: "handoff",
        target_runtime: "adk_python_2_x",
        implementation_template: "llm_agent_selection_stub",
        manual_completion_required: true,
        developer_todos: ["review derived default"]
      }
    }
  });
  generated.cleanup();
});
