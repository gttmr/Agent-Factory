import assert from "node:assert/strict";
import type { ScaffoldPlan } from "../analyzer/types.ts";
import {
  applyMockLabBinding,
  buildMockLabRoute,
  hasMockLabBindingTargets,
  isMcpBoundTool
} from "./mockLabIntegration.ts";

assert.equal(
  buildMockLabRoute({ toolName: "loan precheck/rule", reqId: "req-loan-precheck-smoke" }),
  "/mock-lab?tool=loan+precheck%2Frule&req=req-loan-precheck-smoke"
);

const plan = {
  requirement_id: "req",
  source: "approved_workbench_artifact",
  raw_requirement_to_code: false,
  output_mode: "runnable",
  assets: [
    {
      asset_id: "asset-a",
      name: "Customer account snapshot Tool",
      asset_type: "tool",
      binding: { kind: "unresolved" },
      connection: { transport: "unknown" },
    },
    {
      asset_id: "asset-b",
      name: "Credit risk Agent",
      asset_type: "agent",
      binding: { kind: "unresolved" },
      connection: { transport: "unknown" }
    }
  ],
  runtime_contracts: [],
  excluded_assets: [],
  manifest: { catalog_bound_assets: [], new_code_required: [] },
  validation: { can_generate_source: true, blockers: [], warnings: [] }
} as unknown as ScaffoldPlan;

const next = applyMockLabBinding(plan, "asset-a", {
  serverRef: "customer-account-snapshot-mcp",
  toolName: "customer_account_snapshot",
});

assert.notEqual(next, plan);
assert.deepEqual(next.assets[0].binding, {
  kind: "mcp",
  server_ref: "customer-account-snapshot-mcp",
  tool_name: "customer_account_snapshot"
});
assert.deepEqual(next.assets[0].connection, { transport: "stdio" });
assert.equal(next.assets[1], plan.assets[1]);
assert.equal(isMcpBoundTool(next.assets[0]), true);
assert.equal(isMcpBoundTool(next.assets[1]), false);
assert.equal(hasMockLabBindingTargets(plan), true);
assert.equal(hasMockLabBindingTargets({ ...plan, assets: [plan.assets[1]] }), false);
