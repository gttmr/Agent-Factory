import assert from "node:assert/strict";
import { resolveCatalogPrefillSpec } from "./catalogPrefillSelection.ts";
import type { CatalogPrefillPayload } from "./types/mockSpec.ts";

const payload: CatalogPrefillPayload = {
  loaded_at: "2026-07-19T00:00:00.000Z",
  source_file: "catalog/tools.yaml",
  entries: [
    {
      asset_id: "tool.customer.account-snapshot",
      name: "고객 계좌 Snapshot Tool",
      asset_type: "tool",
      capability_tags: ["data-query"],
      owner: "AI공통플랫폼팀",
      binding: { kind: "mcp", server_ref: "customer-mock", tool_name: "account_snapshot" },
      connection: { transport: "stdio" },
      contract_status: "mock_ready",
      inputs: [],
      outputs: [],
      risk_signals: [],
      has_runtime_mock: true,
      notes: null,
      prefill: {
        mock_id: "tool-customer-account-snapshot",
        server_name: "customer-mock",
        protocol: "mcp_stdio",
        description: "synthetic",
        source: {
          prefill_from_catalog: true,
          catalog_asset_id: "tool.customer.account-snapshot",
          catalog_entry_name: "고객 계좌 Snapshot Tool",
          catalog_file: "catalog/tools.yaml"
        },
        tools: [
          {
            name: "account_snapshot",
            title: "고객 계좌 Snapshot Tool",
            description: "synthetic Tool",
            inputSchema: { type: "object", properties: {}, required: [] },
            outputSchema: { type: "object", properties: {}, required: [] },
            successResponse: {},
            errorScenarios: [],
            latencyMs: 0,
            riskSignals: [],
            auditRequired: false
          }
        ],
        guardrails: {
          synthetic_only: true,
          no_private_data: true,
          no_private_endpoint: true,
          no_credentials: true,
          no_production_business_logic: true
        }
      }
    }
  ]
};

const spec = resolveCatalogPrefillSpec(payload, "고객 계좌 Snapshot Tool");
assert.equal(spec?.mock_id, "tool-customer-account-snapshot");
assert.notEqual(spec, payload.entries[0].prefill);
spec!.mock_id = "changed";
assert.equal(payload.entries[0].prefill.mock_id, "tool-customer-account-snapshot");
assert.equal(resolveCatalogPrefillSpec(payload, "missing"), null);
