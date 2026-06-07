import assert from "node:assert/strict";
import { resolveCatalogPrefillSpec } from "./catalogPrefillSelection.ts";
import type { CatalogPrefillPayload } from "./types/mockSpec.ts";

const payload: CatalogPrefillPayload = {
  loaded_at: "2026-06-04T00:00:00.000Z",
  source_file: "catalog/adapters.yaml",
  entries: [
    {
      name: "customer_account_snapshot_mock_adapter",
      adapter_kind: "data_query",
      owner_domain: "customer",
      access_protocol: "local",
      contract_status: "mock_ready",
      component_source: "stub",
      inputs: [],
      outputs: [],
      risk_signals: [],
      has_runtime_mock: true,
      notes: null,
      prefill: {
        mock_id: "customer_account_snapshot_mock_adapter",
        server_name: "customer_account_snapshot_mock_adapter-mcp",
        protocol: "mcp_stdio",
        description: "synthetic",
        source: {
          prefill_from_catalog: true,
          catalog_entry_name: "customer_account_snapshot_mock_adapter",
          catalog_file: "catalog/adapters.yaml"
        },
        tools: [
          {
            name: "customer_account_snapshot_mock_adapter",
            title: "customer_account_snapshot_mock_adapter",
            description: "synthetic tool",
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

const spec = resolveCatalogPrefillSpec(payload, "customer_account_snapshot_mock_adapter");
assert.equal(spec?.mock_id, "customer_account_snapshot_mock_adapter");
assert.notEqual(spec, payload.entries[0].prefill);

spec!.mock_id = "changed";
assert.equal(payload.entries[0].prefill.mock_id, "customer_account_snapshot_mock_adapter");
assert.equal(resolveCatalogPrefillSpec(payload, "missing"), null);
