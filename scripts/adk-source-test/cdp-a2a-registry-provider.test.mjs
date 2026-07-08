import assert from "node:assert/strict";
import test from "node:test";
import { approvedRegistryA2AContract, generateRegistrySource } from "./cdp-a2a-fixtures.mjs";
import { remoteModule } from "./fixtures.mjs";

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
  const source = generateRegistrySource({ includeProvider: true });
  const registryFunction = source.match(/async def _fn_mod_registry_discovery\(ctx: Context, node_input=None\) -> dict:[\s\S]*?return payload/)?.[0] ?? "";

  assert.match(registryFunction, /"providers": \[/);
  assert.match(registryFunction, /"connection_status": "configured"/);
  assert.match(registryFunction, /"agent_card_url": "http:\/\/127\.0\.0\.1:8011\/a2a\/reviewed\/\.well-known\/agent-card\.json"/);
  assert.match(registryFunction, /ctx\.state\["agent_registry_snapshot"\] = payload/);
  assert.doesNotMatch(registryFunction, /"connection_status": "unconnected"/);
});

test("Given no approved Remote A2A provider When registry adapter is generated Then safe unconnected placeholder remains", () => {
  const source = generateRegistrySource({ includeProvider: false });
  const registryFunction = source.match(/async def _fn_mod_registry_discovery\(ctx: Context, node_input=None\) -> dict:[\s\S]*?return payload/)?.[0] ?? "";

  assert.match(registryFunction, /"connection_status": "unconnected"/);
  assert.doesNotMatch(registryFunction, /"providers": \[/);
  assert.match(registryFunction, /ctx\.state\["agent_registry_snapshot"\] = payload/);
});
