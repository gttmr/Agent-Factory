import assert from "node:assert/strict";
import { buildContract } from "../../analyzer/a2aContracts.ts";
import { assetCandidate, strictAnalysisFixture } from "../../analyzer/targetContract.testFixture.ts";
import type { A2AContract, AnalysisResult, AssetCandidate } from "../../analyzer/types";
import { runtimeA2aProviderTarget } from "./runtimeA2aProviderTarget";

const approvedA2AAgent = candidate({
  asset_id: "agent.provider-approved",
  owner: "local artifact:req-page-recommendation-required",
  status: "approved",
  binding: { kind: "a2a", contract_ref: "a2a-provider-approved" }
});

const draftA2AAgent = candidate({
  asset_id: "agent.provider-draft",
  owner: "local artifact:req-page-recommendation-draft",
  status: "needs_info",
  binding: { kind: "a2a", contract_ref: "a2a-provider-draft" }
});

assert.deepEqual(runtimeA2aProviderTarget(analysis(
  [draftA2AAgent, approvedA2AAgent],
  [contract(draftA2AAgent), contract(approvedA2AAgent)]
)), {
  reqId: "req-page-recommendation-required",
  source: "a2a_contract",
  agentAssetId: "agent.provider-approved",
  contractId: "a2a-provider-approved"
});

const exposedA2AAgent = candidate({
  asset_id: "agent.provider-exposed",
  owner: "local artifact:req-exposed-provider",
  status: "approved",
  exposure: { protocol: "a2a", contract_ref: "a2a-provider-exposed" }
});

assert.deepEqual(runtimeA2aProviderTarget(analysis([exposedA2AAgent], [contract(exposedA2AAgent)])), {
  reqId: "req-exposed-provider",
  source: "a2a_contract",
  agentAssetId: "agent.provider-exposed",
  contractId: "a2a-provider-exposed"
});

assert.equal(runtimeA2aProviderTarget(analysis([draftA2AAgent], [contract(draftA2AAgent)])), null);

assert.equal(runtimeA2aProviderTarget(analysis([approvedA2AAgent], [])), null);

const mismatchedContract = { ...contract(approvedA2AAgent), agent_ref: "agent.someone-else" };
assert.equal(runtimeA2aProviderTarget(analysis([approvedA2AAgent], [mismatchedContract])), null);

const unboundAgent = candidate({ asset_id: "agent.unbound", status: "approved" });
assert.equal(
  runtimeA2aProviderTarget(analysis([unboundAgent], [{ ...buildContract(unboundAgent, "a2a-unbound"), contract_status: "approved" }])),
  null
);

assert.equal(runtimeA2aProviderTarget(analysis([], [])), null);

function candidate(overrides: Partial<AssetCandidate>): AssetCandidate {
  return assetCandidate({
    name: "Local provider Agent",
    owner: "local artifact:req-provider",
    binding: null,
    exposure: null,
    ...overrides
  });
}

function contract(agent: AssetCandidate): A2AContract {
  const contractRef = agent.binding?.kind === "a2a"
    ? agent.binding.contract_ref
    : agent.exposure?.contract_ref;
  assert.ok(contractRef);
  return {
    ...buildContract(agent, contractRef),
    contract_status: "approved"
  };
}

function analysis(assetCandidates: AssetCandidate[], a2aContracts: A2AContract[]): AnalysisResult {
  return {
    ...strictAnalysisFixture(),
    assetCandidates,
    a2aContracts
  };
}
