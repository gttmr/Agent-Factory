import assert from "node:assert/strict";
import { parseAfRunManifest, serializeAfRunManifest, summarizeAfRunManifest } from "./afRunManifest.ts";

const manifest = parseAfRunManifest(
  JSON.stringify({
    requirement_id: "req-001",
    artifact_root: "artifacts/af/req-001",
    current_stage: "design",
    stages: {
      analyze: { status: "complete", outputs: ["analysis-result.json"] },
      design: { status: "blocked", outputs: ["boundary-design.md"] },
      build: { status: "pending", outputs: [] },
      verify: { status: "pending", outputs: [] }
    },
    approvals: {
      analysis_reviewed: true,
      boundaries_approved: false,
      runtime_contracts_approved: false,
      stub_ready_for_followup: false
    },
    validation: {
      commands: ["node scripts/validate-artifacts.mjs artifacts/af/req-001"],
      last_result: "failed"
    }
  }),
  "af-run-manifest.json"
);

assert.equal(manifest.requirement_id, "req-001");
assert.equal(manifest.current_stage, "design");
assert.equal(manifest.stages.analyze.status, "complete");
assert.equal(manifest.stages.design.outputs[0], "boundary-design.md");
assert.equal(manifest.approvals.analysis_reviewed, true);
assert.equal(manifest.validation.last_result, "failed");

const summary = summarizeAfRunManifest(manifest);
assert.equal(summary.stageLabel, "설계");
assert.equal(summary.stageStatus, "blocked");
assert.equal(summary.stageStatusLabel, "차단");
assert.equal(summary.completedStages, 1);
assert.equal(summary.totalStages, 4);
assert.equal(summary.validationLabel, "failed");
assert.equal(summary.validationStatusLabel, "실패");

const serialized = serializeAfRunManifest(manifest);
assert.ok(serialized.endsWith("\n"));
assert.equal(JSON.parse(serialized).requirement_id, "req-001");

assert.throws(() => parseAfRunManifest("[]", "bad.json"), /object/);
assert.throws(() => parseAfRunManifest(JSON.stringify({ requirement_id: "" }), "bad.json"), /requirement_id/);
