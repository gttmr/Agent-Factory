import assert from "node:assert/strict";
import { createA2AContractForCandidate, mintNextContractId } from "./a2aContracts.ts";
import { strictAnalysisFixture } from "./targetContract.testFixture.ts";
import { validateTargetAnalysisResult } from "./targetContract.ts";
import "./localA2aProvider.test.ts";

assert.equal(mintNextContractId(new Set(["a2a-001", "a2a-002"])), "a2a-003");
const analysis = strictAnalysisFixture();
const next = createA2AContractForCandidate(analysis, "agent.reviewer");
assert.equal(next.a2aContracts[0]?.agent_ref, "agent.reviewer");
assert.deepEqual(next.assetCandidates.find((candidate) => candidate.asset_id === "agent.reviewer")?.binding, { kind: "a2a", contract_ref: "a2a-001" });
assert.deepEqual(validateTargetAnalysisResult(next), [], "A2A binding, exposure, contract, and Agent ref remain functional in strict v2");
assert.equal(analysis.a2aContracts.length, 0);
console.log("A2A Target contract tests passed");
