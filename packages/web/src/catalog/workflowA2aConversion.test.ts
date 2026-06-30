import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appendCatalogDeltaProposal, parseCatalogDelta } from "./catalogDelta.ts";
import type { CatalogHubEntry } from "./catalogIndex.ts";
import { buildWorkflowA2aConversionProposal } from "./workflowA2aConversion.ts";

const helperSource = readFileSync(new URL("./workflowA2aConversion.ts", import.meta.url), "utf8");
assert.equal(
  /from\s+["'][^"']*(?:server|state|react|@tanstack\/react-query)[^"']*["']|fetch\s*\(|XMLHttpRequest|https?:\/\//.test(helperSource),
  false
);

const providerCard = {
  provider_req_id: "req-provider",
  app_name: "Provider Workflow",
  rpc_url: "http://127.0.0.1:8123",
  agent_card_url: "http://127.0.0.1:8123/.well-known/agent-card.json",
  card: {
    name: "Provider Workflow",
    description: "Exposes the reviewed workflow as a local A2A provider.",
    url: "http://127.0.0.1:8123",
    version: "1.0.0",
    preferredTransport: "JSONRPC",
    protocolVersion: "0.3.0",
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["application/json"],
    capabilities: {
      extensions: [],
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false
    },
    skills: []
  }
};

const workflowEntry: CatalogHubEntry = {
  id: "workflow:loan-review",
  category: "workflow",
  name: "loan_review_workflow",
  workflow_kind: "graph",
  owner_domain: "여신",
  responsibility: "Route reviewed loan cases through specialist checks.",
  inputs: [{ name: "case_id", type: "string", required: true }],
  outputs: [{ name: "decision", type: "string" }],
  composition: ["eligibility_agent", "risk_adapter"],
  risk_signals: ["financial_data", "audit_required"],
  required_before_approval: ["owner_review"],
  contract_status: "mock_ready",
  notes: "Seed workflow note"
};

const sourceSnapshot = structuredClone(workflowEntry);
const result = buildWorkflowA2aConversionProposal(workflowEntry, "req-provider", providerCard);

assert.deepEqual(result, {
  ok: true,
  proposal: {
    module_category: "workflow",
    name: "loan_review_workflow",
    workflow_kind: "graph",
    owner_domain: "여신",
    responsibility: "Route reviewed loan cases through specialist checks.",
    inputs: [{ name: "case_id", type: "string", required: true }],
    outputs: [{ name: "decision", type: "string" }],
    composition: ["eligibility_agent", "risk_adapter"],
    risk_signals: ["financial_data", "audit_required"],
    required_before_approval: ["owner_review"],
    contract_status: "a2a_ready",
    component_source: "remote_a2a",
    runtime_binding: "remote_a2a",
    a2a_provider_req_id: "req-provider",
    notes: "A2A-capable version of loan_review_workflow using provider req-provider (Provider Workflow)."
  }
});
assert.deepEqual(workflowEntry, sourceSnapshot);

if (!result.ok) {
  throw new Error("expected workflow conversion proposal");
}
const appended = appendCatalogDeltaProposal("notes: keep\n", result.proposal);
const parsed = parseCatalogDelta(appended);
assert.deepEqual(parsed, {
  proposals: [result.proposal],
  error: null
});

const adapterResult = buildWorkflowA2aConversionProposal(
  {
    id: "adapter:notice-template",
    category: "adapter",
    name: "notice_template",
    adapter_kind: "template"
  },
  "req-provider",
  providerCard
);
assert.deepEqual(adapterResult, {
  ok: false,
  error: {
    code: "not_workflow",
    message: "Workflow A2A conversion requires a workflow catalog entry.",
    category: "adapter"
  }
});

const agentResult = buildWorkflowA2aConversionProposal(
  {
    id: "agent:risk-specialist",
    category: "agent",
    name: "risk_specialist",
    agent_kind: "specialist"
  },
  "req-provider",
  providerCard
);
assert.deepEqual(agentResult, {
  ok: false,
  error: {
    code: "not_workflow",
    message: "Workflow A2A conversion requires a workflow catalog entry.",
    category: "agent"
  }
});

const emptyProviderResult = buildWorkflowA2aConversionProposal(workflowEntry, " ", providerCard);
assert.deepEqual(emptyProviderResult, {
  ok: false,
  error: {
    code: "missing_provider_req_id",
    message: "Workflow A2A conversion requires a provider artifact root id."
  }
});

const mismatchedCardResult = buildWorkflowA2aConversionProposal(workflowEntry, "req-provider", {
  ...providerCard,
  provider_req_id: "req-other"
});
assert.deepEqual(mismatchedCardResult, {
  ok: false,
  error: {
    code: "provider_card_mismatch",
    message: "Runtime A2A Agent Card does not match the selected provider artifact root id.",
    provider_req_id: "req-other"
  }
});
