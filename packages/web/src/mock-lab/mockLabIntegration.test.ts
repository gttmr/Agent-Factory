import assert from "node:assert/strict";
import {
  applyMockLabBinding,
  buildMockLabRoute,
  isMcpBoundAdapter
} from "./mockLabIntegration.ts";
import type { ScaffoldPlan } from "../analyzer/types.ts";

const route = buildMockLabRoute({
  adapterName: "loan precheck/rule",
  reqId: "req-loan-precheck-smoke"
});

assert.equal(route, "/mock-lab?adapter=loan+precheck%2Frule&req=req-loan-precheck-smoke");

const plan = {
  requirement_id: "req",
  source: "approved_workbench_artifact",
  raw_requirement_to_code: false,
  output_mode: "runnable",
  modules: [
    {
      id: "mod-a",
      name: "customer_account_snapshot_mock_adapter",
      module_category: "adapter",
      access_protocol: "local",
      mcp_server: null,
      mcp_tool_name: null,
      mcp_schema_ref: null,
      runtime_binding: "unresolved"
    },
    {
      id: "mod-b",
      name: "credit_risk_reasoning_mock_agent",
      module_category: "agent",
      access_protocol: null,
      mcp_server: null,
      mcp_tool_name: null,
      mcp_schema_ref: null,
      runtime_binding: null
    }
  ],
  runtime_contracts: [],
  excluded_modules: [],
  manifest: { catalog_bound_modules: [], new_code_required: [] },
  validation: { can_generate_source: true, blockers: [], warnings: [] }
} as unknown as ScaffoldPlan;

const next = applyMockLabBinding(plan, "mod-a", {
  mcpServer: "customer-account-snapshot-mcp",
  mcpToolName: "customer_account_snapshot_mock_adapter",
  mcpSchemaRef: "catalog.synthetic.customer_snapshot.v1"
});

assert.notEqual(next, plan);
assert.equal(next.modules[0].access_protocol, "mcp");
assert.equal(next.modules[0].mcp_server, "customer-account-snapshot-mcp");
assert.equal(next.modules[0].mcp_tool_name, "customer_account_snapshot_mock_adapter");
assert.equal(next.modules[0].mcp_schema_ref, "catalog.synthetic.customer_snapshot.v1");
assert.equal(next.modules[0].runtime_binding, "mcp");
assert.equal(next.modules[1], plan.modules[1]);
assert.equal(plan.modules[0].access_protocol, "local");
assert.equal(isMcpBoundAdapter(next.modules[0]), true);
assert.equal(isMcpBoundAdapter(next.modules[1]), false);
