import assert from "node:assert/strict";
import { approveCandidate, resolveMissingItem, setCandidateStatus } from "./assetReview.ts";
import { assetCandidate } from "./targetContract.testFixture.ts";

const unresolved = assetCandidate({ status: "needs_info", missing_information: ["owner"] });
assert.equal(approveCandidate(unresolved), unresolved);
const resolved = resolveMissingItem(unresolved, "owner", "platform owns it");
assert.equal(approveCandidate(resolved).status, "approved");

for (const candidate of [
  assetCandidate({ binding: { kind: "unresolved" }, connection: { transport: "unknown" } }),
  assetCandidate({ binding: { kind: "function" }, connection: { transport: "unknown" } }),
  assetCandidate({
    asset_id: "workflow.unresolved",
    asset_type: "workflow",
    workflow_profile: { representation: "unresolved", coordination: "explicit", template_ref: null }
  }),
  assetCandidate({ status: "needs_info", missing_information: ["auth"] })
]) {
  assert.equal(approveCandidate(candidate), candidate, `${candidate.asset_id} must remain unapproved while semantic readiness is unresolved`);
}

assert.equal(setCandidateStatus(resolved, "deferred").status, "deferred");
console.log("asset review tests passed");
