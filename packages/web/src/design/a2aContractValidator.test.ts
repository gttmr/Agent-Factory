import assert from "node:assert/strict";
import remoteA2AScenario from "../../../../templates/regression-scenarios/scenario-e-true-remote-a2a/analysis-result.json" with { type: "json" };
import type { A2AContract, AnalysisResult } from "../analyzer/types.ts";
import { a2aContractReadinessIssues, a2aContractsGateReady } from "./a2aContractValidator.ts";

function cloneScenario(): AnalysisResult {
  return JSON.parse(JSON.stringify(remoteA2AScenario)) as AnalysisResult;
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
  agent_card: {
    ...unresolvedContract.agent_card,
    version: "2026-05-01"
  },
  skills: ["credit-analysis"]
};
const readyAnalysis: AnalysisResult = {
  ...unresolved,
  moduleCandidates: unresolved.moduleCandidates.map((candidate) => ({
    ...candidate,
    status: "approved",
    missing_information: []
  })),
  a2aContracts: [readyContract]
};

assert.deepEqual(a2aContractReadinessIssues(readyContract), []);
assert.equal(a2aContractsGateReady(readyAnalysis), true);

assert.equal(
  a2aContractsGateReady({
    ...readyAnalysis,
    moduleCandidates: [],
    a2aContracts: []
  }),
  true
);
assert.equal(a2aContractsGateReady({ ...readyAnalysis, a2aContracts: [] }), false);
