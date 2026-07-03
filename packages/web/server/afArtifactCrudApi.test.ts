import assert from "node:assert/strict";
import type { AfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { projectApprovalStageStatuses } from "./afArtifactCrudApi.ts";

const completeManifest = {
  requirement_id: "req-approval-status",
  artifact_root: "artifacts/af/req-approval-status",
  current_stage: "build",
  stages: {
    analyze: { status: "complete", outputs: ["analysis-result.json"] },
    design: { status: "complete", outputs: ["scaffold-plan.json"] },
    build: { status: "complete", outputs: ["runtime-stub/implementation-handoff.md"] },
    verify: { status: "blocked", outputs: ["validation-report.md"] }
  },
  approvals: {
    analysis_reviewed: true,
    boundaries_approved: true,
    runtime_contracts_approved: true,
    stub_ready_for_followup: true
  },
  validation: { commands: [], last_result: "not_run" }
} satisfies AfRunManifest;

const projected = projectApprovalStageStatuses(completeManifest, {
  analysis_reviewed: false,
  boundaries_approved: true,
  runtime_contracts_approved: false,
  stub_ready_for_followup: false
});

assert.equal(projected.analyze.status, "pending");
assert.equal(projected.design.status, "pending");
assert.equal(projected.build.status, "pending");
assert.equal(projected.verify.status, "blocked");
assert.deepEqual(projected.analyze.outputs, completeManifest.stages.analyze.outputs);
assert.deepEqual(projected.design.outputs, completeManifest.stages.design.outputs);
assert.deepEqual(projected.build.outputs, completeManifest.stages.build.outputs);
