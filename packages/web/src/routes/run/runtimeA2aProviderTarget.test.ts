import assert from "node:assert/strict";
import type { AnalysisResult, ModuleCandidate } from "../../analyzer/types";
import { runtimeA2aProviderTarget } from "./runtimeA2aProviderTarget";

const approvedRemoteCandidate = candidate({
  id: "mod-provider-approved",
  owner: "local artifact:req-page-recommendation-required",
  status: "approved"
});

const draftRemoteCandidate = candidate({
  id: "mod-provider-draft",
  owner: "local artifact:req-page-recommendation-draft",
  status: "needs_info"
});

assert.deepEqual(runtimeA2aProviderTarget(analysis([draftRemoteCandidate, approvedRemoteCandidate]), "consumer"), {
  reqId: "req-page-recommendation-required",
  source: "remote_a2a_contract",
  remoteModuleId: "mod-provider-approved"
});

assert.deepEqual(runtimeA2aProviderTarget(analysis([draftRemoteCandidate]), "consumer"), {
  reqId: "consumer",
  source: "current_artifact",
  remoteModuleId: null
});

assert.deepEqual(runtimeA2aProviderTarget(analysis([]), "provider-root"), {
  reqId: "provider-root",
  source: "current_artifact",
  remoteModuleId: null
});

function candidate(input: Pick<ModuleCandidate, "id" | "owner" | "status">): ModuleCandidate {
  return {
    id: input.id,
    source_requirement_id: "consumer",
    name: "req_page_recommendation_required_adk",
    module_category: "remote_a2a",
    agent_kind: null,
    workflow_kind: null,
    adapter_kind: null,
    remote_contract_kind: "a2a",
    confidence: 0.95,
    rationale: "Local provider import.",
    inputs: [{ name: "message", type: "string", required: true }],
    outputs: [{ name: "response", type: "string", required: true }],
    reuse_candidate: true,
    risk_level: "high",
    risk_signals: ["audit_required"],
    status: input.status,
    missing_information: [],
    owner: input.owner,
    a2a_contract_id: "a2a-001"
  };
}

function analysis(moduleCandidates: ModuleCandidate[]): AnalysisResult {
  return {
    normalizedRequirement: {
      id: "consumer",
      title: "Consumer",
      raw_text: "run a remote provider",
      domain: "test",
      requester: { team: "qa", role: "reviewer" },
      business_goal: "test",
      current_process: [],
      inputs: [],
      outputs: [],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "reviewed"
    },
    evidence: {
      requested_goal: "test",
      business_domain_hint: "test",
      user_role: "reviewer",
      input_data: [],
      output_data: [],
      systems_mentioned: [],
      decisions_implied: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      assumptions: []
    },
    moduleCandidates,
    a2aContracts: [],
    runtimeContracts: [],
    processFlow: {
      requirement_id: "consumer",
      graph_id: "graph-consumer",
      root_workflow_module_id: null,
      nodes: [],
      edges: [],
      containers: [],
      lanes: [],
      validation: { ok: true, errors: [], warnings: [] }
    }
  };
}
