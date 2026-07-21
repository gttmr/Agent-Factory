import assert from "node:assert/strict";
import remoteA2AScenario from "../../../../templates/regression-scenarios/scenario-e-true-remote-a2a/analysis-result.json" with { type: "json" };
import { buildContract, buildDefaultA2ARuntimePolicy } from "../analyzer/a2aContracts.ts";
import type { A2AContract, AnalysisResult } from "../analyzer/types.ts";
import {
  buildA2AReviewRows,
  createA2AContractDraft,
  createEmptyA2AInterface,
  formatA2ANullableNumber,
  hasA2AContractDraftChanges,
  isA2AContractApprovalBlocked,
  nullableA2AText,
  parseA2ANullableNumber,
  splitA2ATextList
} from "./A2AContractPanelModel.ts";

const scenario = remoteA2AScenario as unknown as AnalysisResult;
const scenarioContract = scenario.a2aContracts[0] as A2AContract;
const scenarioAsset = scenario.assetCandidates.find((asset) => asset.asset_id === scenarioContract.agent_ref)!;
const baseContract = buildContract(scenarioAsset, scenarioContract.contract_id);
const contract = { ...baseContract, ...scenarioContract, contract_status: "needs_info" as const, agent_card: { ...baseContract.agent_card, ...scenarioContract.agent_card } };
const rows = buildA2AReviewRows(scenario.assetCandidates, [contract]);

assert.equal(rows.length, 1);
assert.equal(rows[0]?.candidate.asset_id, contract.agent_ref);
assert.equal(rows[0]?.contract, contract);
assert.ok(rows[0]?.issues.includes("contract_status must be approved before ADK Runtime Handoff"));

const contractWithoutRuntimePolicy = { ...contract, adk_runtime_policy: null } as unknown as A2AContract;
const draftWithDefault = createA2AContractDraft(contractWithoutRuntimePolicy);
assert.deepEqual(draftWithDefault.adk_runtime_policy, buildDefaultA2ARuntimePolicy());
assert.equal(hasA2AContractDraftChanges(contractWithoutRuntimePolicy, draftWithDefault), true);
assert.equal(hasA2AContractDraftChanges(contract, createA2AContractDraft(contract)), false);

assert.equal(isA2AContractApprovalBlocked({ ...contract, contract_status: "approved" }, ["auth is missing"]), true);
assert.equal(
  isA2AContractApprovalBlocked(
    { ...contract, contract_status: "approved" },
    ["contract_status must be approved before ADK Runtime Handoff"]
  ),
  false
);
assert.equal(isA2AContractApprovalBlocked(contract, ["auth is missing"]), false);

assert.deepEqual(splitA2ATextList(" one, two\n\nthree "), ["one", "two", "three"]);
assert.equal(nullableA2AText("  "), null);
assert.equal(nullableA2AText(" value "), "value");
assert.equal(formatA2ANullableNumber(null), "");
assert.equal(formatA2ANullableNumber(5), "5");
assert.equal(parseA2ANullableNumber(""), null);
assert.equal(parseA2ANullableNumber("invalid"), null);
assert.equal(parseA2ANullableNumber(" 2.5 "), 2.5);
assert.deepEqual(createEmptyA2AInterface(), {
  url: "needs_info",
  protocol_binding: "HTTP+JSON",
  protocol_version: "A2A 1.0",
  tenant_policy: "needs_info"
});
