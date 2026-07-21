import assert from "node:assert/strict";
import remoteA2AScenario from "../../../../templates/regression-scenarios/scenario-e-true-remote-a2a/analysis-result.json" with { type: "json" };
import a2aConsumingScenario from "../../../../templates/skill-scenarios/S07-a2a-consuming/context/analysis-result.json" with { type: "json" };
import type { A2AContract, AnalysisResult } from "../analyzer/types.ts";
import { buildContract } from "../analyzer/a2aContracts.ts";
import { a2aContractReadinessIssues, a2aContractsGateReady } from "./a2aContractValidator.ts";

function cloneScenario(): AnalysisResult {
  const scenario = JSON.parse(JSON.stringify(remoteA2AScenario)) as AnalysisResult;
  const sparse = scenario.a2aContracts[0] as A2AContract;
  const asset = scenario.assetCandidates.find((candidate) => candidate.asset_id === sparse.agent_ref)!;
  const base = buildContract(asset, sparse.contract_id);
  return {
    ...scenario,
    a2aContracts: [{
      ...base,
      ...sparse,
      contract_status: "needs_info",
      skills: ["needs_info"],
      agent_card: { ...base.agent_card, ...sparse.agent_card, version: "needs_info" }
    }]
  };
}

const unresolved = cloneScenario();
const unresolvedContract = unresolved.a2aContracts[0] as A2AContract;
const unresolvedIssues = a2aContractReadinessIssues(unresolvedContract);

assert.ok(unresolvedIssues.includes("contract_status must be approved before ADK Runtime Handoff"));
assert.ok(unresolvedIssues.includes("agent_card.version is still needs_info"));
assert.ok(unresolvedIssues.includes("skills must not contain needs_info"));
assert.equal(a2aContractsGateReady(unresolved), false);

const readyContract: A2AContract = {
  ...unresolvedContract,
  contract_status: "approved",
  target_agent_purpose: "Reviewed remote capability",
  agent_card: {
    ...unresolvedContract.agent_card,
    discovery_method: "well_known",
    version: "2026-05-01",
    notes: "reviewed"
  },
  supported_interfaces: [{ url: "https://example.test/a2a", protocol_binding: "HTTP+JSON", protocol_version: "1.0", tenant_policy: "isolated" }],
  security_schemes: [{ name: "bearer", scheme: "bearer" }],
  security_requirements: [{ scheme_name: "bearer", scopes: ["invoke"] }],
  adk_runtime_policy: {
    timeout_seconds: 60,
    auth: {
      mode: "bearer_env",
      env_var: "AF_A2A_CREDIT_ANALYSIS_TOKEN",
      metadata_key: null
    },
    retry_handoff: {
      max_attempts: 2,
      backoff_seconds: 5,
      retry_on: ["transient_transport_error"]
    },
    fallback_handoff: {
      mode: "manual_review",
      message: "Route to the local human reviewer when the remote agent does not produce a terminal outcome."
    }
  },
  skills: ["credit-analysis"],
  task_lifecycle: { ...unresolvedContract.task_lifecycle, input_required_followup: "request input", auth_required_followup: "request auth" },
  artifact_contract: { mutation_rules: "append only", chunking_policy: "none" },
  adk_host_mapping: "remote_agent",
  timeout: "60 seconds",
  retry: "two attempts",
  fallback: "manual review",
  cancellation: "supported",
  unsupported_operation: "reject",
  get_task_fallback: "poll",
  auth: "bearer",
  token_handling: "environment only",
  audit: "required",
  data_policy: "synthetic only"
};
const readyAnalysis: AnalysisResult = {
  ...unresolved,
  assetCandidates: unresolved.assetCandidates.map((candidate) => ({
    ...candidate,
    status: "approved",
    missing_information: []
  })),
  a2aContracts: [readyContract]
};

assert.deepEqual(a2aContractReadinessIssues(readyContract), []);
assert.equal(a2aContractsGateReady(readyAnalysis), true);

const noAuthContract: A2AContract = {
  ...readyContract,
  security_schemes: [],
  security_requirements: [],
  adk_runtime_policy: {
    ...readyContract.adk_runtime_policy,
    auth: {
      mode: "none",
      env_var: null,
      metadata_key: null
    }
  }
};
const noAuthAnalysis: AnalysisResult = {
  ...readyAnalysis,
  a2aContracts: [noAuthContract]
};

assert.deepEqual(a2aContractReadinessIssues(noAuthContract), []);
assert.equal(a2aContractsGateReady(noAuthAnalysis), true);

const malformedNoAuthSecurityIssues = a2aContractReadinessIssues({
  ...noAuthContract,
  security_schemes: [{ name: "", scheme: "bearer" }],
  security_requirements: [{ scheme_name: "", scopes: [] }]
});
assert.ok(malformedNoAuthSecurityIssues.includes("security_schemes[0].name is missing"));
assert.ok(malformedNoAuthSecurityIssues.includes("security_requirements[0].scheme_name is missing"));

const bearerWithoutSecurityIssues = a2aContractReadinessIssues({
  ...readyContract,
  security_schemes: [],
  security_requirements: []
});
assert.ok(bearerWithoutSecurityIssues.includes("security_schemes must include at least one reviewed value"));
assert.ok(bearerWithoutSecurityIssues.includes("security_requirements must include at least one reviewed value"));

assert.ok(
  a2aContractReadinessIssues({
    ...readyContract,
    adk_runtime_policy: {
      ...readyContract.adk_runtime_policy,
      auth: {
        mode: "bearer_env",
        env_var: null,
        metadata_key: null
      }
    }
  }).includes("adk_runtime_policy.auth.env_var is missing")
);
assert.ok(
  a2aContractReadinessIssues({
    ...readyContract,
    adk_runtime_policy: {
      ...readyContract.adk_runtime_policy,
      auth: {
        mode: "metadata_env",
        env_var: "AF_A2A_PARTNER_METADATA_TOKEN",
        metadata_key: null
      }
    }
  }).includes("adk_runtime_policy.auth.metadata_key is missing for metadata_env")
);

assert.equal(
  a2aContractsGateReady({
    ...readyAnalysis,
    assetCandidates: [],
    a2aContracts: []
  }),
  true
);
assert.equal(a2aContractsGateReady({ ...readyAnalysis, a2aContracts: [] }), false);

assert.deepEqual(a2aContractReadinessIssues(a2aConsumingScenario.a2aContracts[0] as A2AContract), []);
assert.equal(a2aContractsGateReady(a2aConsumingScenario as AnalysisResult), true);
