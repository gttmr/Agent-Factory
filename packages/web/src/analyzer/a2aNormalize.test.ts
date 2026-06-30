import assert from "node:assert/strict";
import { createA2AContractForCandidate, mintNextContractId, normalizeA2A } from "./a2aNormalize.ts";
import "./localA2aProvider.test.ts";
import type { AnalysisResult, ModuleCandidate } from "./types.ts";

const placeholderRuntimePolicy = {
  timeout_seconds: null,
  auth: {
    mode: "bearer_env",
    env_var: null,
    metadata_key: null
  },
  retry_handoff: {
    max_attempts: null,
    backoff_seconds: null,
    retry_on: []
  },
  fallback_handoff: {
    mode: "manual_review",
    message: null
  }
};

const remoteCandidate: ModuleCandidate = {
  id: "mod-remote",
  source_requirement_id: "req-001",
  name: "remote partner",
  module_category: "remote_a2a",
  agent_kind: null,
  workflow_kind: null,
  adapter_kind: null,
  remote_contract_kind: "a2a",
  legacy_recommended_type: "remote_a2a_contract",
  confidence: 0.8,
  rationale: "Remote boundary",
  inputs: [],
  outputs: [],
  reuse_candidate: false,
  risk_level: "high",
  risk_signals: [],
  status: "needs_info",
  missing_information: [],
  a2a_contract_id: null
};

const analysis: AnalysisResult = {
  normalizedRequirement: {} as AnalysisResult["normalizedRequirement"],
  evidence: {} as AnalysisResult["evidence"],
  moduleCandidates: [
    { ...remoteCandidate },
    {
      ...remoteCandidate,
      id: "mod-existing",
      a2a_contract_id: "a2a-001"
    }
  ],
  a2aContracts: [
    {
      contract_id: "a2a-002",
      remote_module_id: "mod-existing"
    } as AnalysisResult["a2aContracts"][number]
  ],
  runtimeContracts: [],
  processFlow: {} as AnalysisResult["processFlow"]
};

const next = createA2AContractForCandidate(analysis, "mod-remote");
const updatedCandidate = next.moduleCandidates.find((candidate) => candidate.id === "mod-remote");

assert.notEqual(next, analysis);
assert.equal(updatedCandidate?.a2a_contract_id, "a2a-003");
assert.equal(next.a2aContracts.length, 2);
assert.equal(next.a2aContracts[1]?.contract_id, "a2a-003");
assert.equal(next.a2aContracts[1]?.remote_module_id, "mod-remote");
assert.equal(next.a2aContracts[1]?.target_agent_name, "needs_info");
assert.deepEqual(next.a2aContracts[1]?.adk_runtime_policy, placeholderRuntimePolicy);
assert.equal(analysis.moduleCandidates[0]?.a2a_contract_id, null);

const normalized = normalizeA2A(analysis);
const normalizedExisting = normalized.result.a2aContracts.find((contract) => contract.contract_id === "a2a-002");
assert.deepEqual(normalizedExisting?.adk_runtime_policy, placeholderRuntimePolicy);
assert.ok(
  normalized.diagnostics.some(
    (diagnostic) => diagnostic.subjectId === "a2a-002" && diagnostic.fields?.includes("adk_runtime_policy")
  )
);

assert.equal(mintNextContractId(new Set()), "a2a-001");
assert.equal(mintNextContractId(new Set(["a2a-001", "a2a-002"])), "a2a-003");

const baseline = normalizeA2A({
  normalizedRequirement: {} as AnalysisResult["normalizedRequirement"],
  evidence: {} as AnalysisResult["evidence"],
  moduleCandidates: [],
  a2aContracts: [],
  runtimeContracts: [],
  processFlow: {} as AnalysisResult["processFlow"]
});
assert.deepEqual(baseline.result.a2aContracts, []);
