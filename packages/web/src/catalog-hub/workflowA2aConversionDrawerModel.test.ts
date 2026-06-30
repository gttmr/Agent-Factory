import assert from "node:assert/strict";
import { parseCatalogDelta } from "../catalog/catalogDelta.ts";
import type { CatalogHubEntry } from "../catalog/catalogIndex.ts";
import type { RuntimeA2aAgentCardResult } from "../state/useRuntimeA2a.ts";
import type { ArtifactRootSummary } from "../state/apiClient.ts";
import {
  appendWorkflowA2aConversionProposal,
  chooseWorkflowA2aProviderReqId,
  getEligibleA2aProviderRoots,
  getWorkflowA2aActionState
} from "./workflowA2aConversionDrawerModel.ts";

const workflowEntry: CatalogHubEntry = {
  id: "workflow:page-recommendation",
  category: "workflow",
  name: "page_recommendation_workflow",
  workflow_kind: "graph",
  owner_domain: "content",
  responsibility: "추천 후보를 검토하고 페이지 응답을 구성합니다.",
  inputs: [{ name: "page_id", type: "string", required: true }],
  outputs: [{ name: "recommendations", type: "array<object>" }],
  a2a_provider_req_id: "req-provider-ready"
};

const adapterEntry: CatalogHubEntry = {
  id: "adapter:search-index",
  category: "adapter",
  name: "search_index",
  adapter_kind: "retrieval"
};

const roots: ArtifactRootSummary[] = [
  {
    requirement_id: "req-provider-draft",
    artifact_root: "/tmp/req-provider-draft",
    current_stage: "build",
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: false
    },
    updated_at: "2026-06-30T00:00:00.000Z"
  },
  {
    requirement_id: "req-provider-ready",
    artifact_root: "/tmp/req-provider-ready",
    current_stage: "verify",
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: true
    },
    updated_at: "2026-06-30T00:01:00.000Z"
  },
  {
    requirement_id: "req-provider-other",
    artifact_root: "/tmp/req-provider-other",
    current_stage: "verify",
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: true,
      runtime_contracts_approved: true,
      stub_ready_for_followup: true
    },
    updated_at: "2026-06-30T00:02:00.000Z"
  }
];

assert.deepEqual(getWorkflowA2aActionState(workflowEntry, "req-active"), {
  visible: true,
  disabledReason: null
});

assert.deepEqual(getWorkflowA2aActionState(adapterEntry, "req-active"), {
  visible: false,
  disabledReason: null
});

assert.deepEqual(getWorkflowA2aActionState(workflowEntry, ""), {
  visible: true,
  disabledReason: "활성 artifact root 가 없어 catalog-delta.yaml 제안을 저장할 수 없습니다."
});

const eligibleRoots = getEligibleA2aProviderRoots(roots);
assert.deepEqual(
  eligibleRoots.map((root) => root.requirement_id),
  ["req-provider-ready", "req-provider-other"]
);

assert.equal(chooseWorkflowA2aProviderReqId(workflowEntry, eligibleRoots), "req-provider-ready");
assert.equal(
  chooseWorkflowA2aProviderReqId({ ...workflowEntry, a2a_provider_req_id: "req-missing" }, eligibleRoots),
  "req-provider-ready"
);
assert.equal(chooseWorkflowA2aProviderReqId({ ...workflowEntry, a2a_provider_req_id: undefined }, []), "");

const agentCard: RuntimeA2aAgentCardResult = {
  provider_req_id: "req-provider-ready",
  app_name: "Page Recommendation Provider",
  rpc_url: "http://127.0.0.1:8001/a2a",
  agent_card_url: "http://127.0.0.1:8001/.well-known/agent-card.json",
  card: {
    name: "Page Recommendation Provider",
    description: "Provider card text is untrusted display content.",
    url: "http://127.0.0.1:8001/a2a",
    version: "1.0.0",
    preferredTransport: "JSONRPC",
    protocolVersion: "0.3.0",
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    capabilities: {
      extensions: [],
      streaming: false
    },
    skills: []
  }
};

const appended = appendWorkflowA2aConversionProposal({
  existingCatalogDelta: "notes: keep\n",
  entry: workflowEntry,
  providerReqId: "req-provider-ready",
  agentCard
});

const parsed = parseCatalogDelta(appended);
assert.equal(parsed.error, null);
assert.equal(parsed.proposals.length, 1);
assert.equal(parsed.proposals[0]?.a2a_provider_req_id, "req-provider-ready");
assert.equal(parsed.proposals[0]?.runtime_binding, "remote_a2a");
assert.equal(parsed.proposals[0]?.component_source, "remote_a2a");
