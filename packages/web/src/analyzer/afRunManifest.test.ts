import assert from "node:assert/strict";
import { parseAfRunManifest, serializeAfRunManifest, summarizeAfRunManifest } from "./afRunManifest.ts";

const manifestValue = {
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
    },
    stage_runs: {
      analyze: {
        latest_run_id: "20260527T130000Z-analyze-a1b2c3",
        status: "completed",
        started_at: "2026-05-27T13:00:00.000Z",
        finished_at: "2026-05-27T13:02:00.000Z",
        skill_name: "af-discover-assets",
        model: "gpt-5.5",
        output_artifacts: [
          "runs/analyze/20260527T130000Z-analyze-a1b2c3/proposed-artifacts/analysis-result.json"
        ],
        last_error: null,
        codex: {
          backend: "sdk",
          thread_id: "thread-001",
          event_count: 7
        }
      }
    }
  };
const manifest = parseAfRunManifest(
  JSON.stringify(manifestValue),
  "af-run-manifest.json"
);

assert.equal(manifest.requirement_id, "req-001");
assert.equal(manifest.current_stage, "design");
assert.equal(manifest.stages.analyze.status, "complete");
assert.equal(manifest.stages.design.outputs[0], "boundary-design.md");
assert.equal(manifest.approvals.analysis_reviewed, true);
assert.equal(manifest.validation.last_result, "failed");
assert.equal(manifest.stage_runs?.analyze?.latest_run_id, "20260527T130000Z-analyze-a1b2c3");
assert.equal(manifest.stage_runs?.analyze?.status, "completed");
assert.deepEqual(manifest.stage_runs?.analyze?.codex, {
  backend: "sdk",
  thread_id: "thread-001",
  event_count: 7
});
assert.equal(manifest.stage_runs?.design, undefined);
assert.deepEqual(manifest, manifestValue, "valid manifests must parse without projection loss");

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
assert.equal(JSON.parse(serialized).stage_runs.analyze.skill_name, "af-discover-assets");
assert.deepEqual(JSON.parse(serialized), manifestValue, "valid parse/serialize must round-trip deeply");

const emptyStageRunsValue = { ...manifestValue, stage_runs: {} };
const emptyStageRunsManifest = parseAfRunManifest(JSON.stringify(emptyStageRunsValue), "empty-stage-runs.json");
assert.deepEqual(JSON.parse(serializeAfRunManifest(emptyStageRunsManifest)), emptyStageRunsValue);

const historicalManifestValue = JSON.parse(serialized);
historicalManifestValue.stage_runs.analyze.skill_name = "historical-custom-skill";
const historicalManifest = parseAfRunManifest(JSON.stringify(historicalManifestValue), "historical-af-run-manifest.json");
assert.equal(historicalManifest.stage_runs?.analyze?.skill_name, "historical-custom-skill");
assert.equal(JSON.parse(serializeAfRunManifest(historicalManifest)).stage_runs.analyze.skill_name, "historical-custom-skill");

const unknownFieldCases = [
  { ...manifestValue, extension: true },
  { ...manifestValue, stages: { ...manifestValue.stages, extension: {} } },
  { ...manifestValue, stages: { ...manifestValue.stages, analyze: { ...manifestValue.stages.analyze, extension: true } } },
  { ...manifestValue, approvals: { ...manifestValue.approvals, extension: true } },
  { ...manifestValue, validation: { ...manifestValue.validation, extension: true } },
  { ...manifestValue, stage_runs: { ...manifestValue.stage_runs, analyze: { ...manifestValue.stage_runs.analyze, extension: true } } },
  {
    ...manifestValue,
    stage_runs: {
      ...manifestValue.stage_runs,
      analyze: {
        ...manifestValue.stage_runs.analyze,
        codex: { ...manifestValue.stage_runs.analyze.codex, usage: { input_tokens: 1 } }
      }
    }
  }
];
for (const unknownFieldCase of unknownFieldCases) {
  assert.throws(() => parseAfRunManifest(JSON.stringify(unknownFieldCase), "unknown.json"), /알 수 없는 필드/);
}

assert.throws(() => parseAfRunManifest("[]", "bad.json"), /object/);
assert.throws(() => parseAfRunManifest(JSON.stringify({ requirement_id: "" }), "bad.json"), /requirement_id/);
assert.throws(
  () => parseAfRunManifest(JSON.stringify({ ...JSON.parse(serialized), current_stage: undefined }), "bad.json"),
  /current_stage/
);
assert.throws(
  () =>
    parseAfRunManifest(
      JSON.stringify({ ...JSON.parse(serialized), stages: { ...JSON.parse(serialized).stages, build: { status: "done", outputs: [] } } }),
      "bad.json"
    ),
  /stages\.build\.status/
);
assert.throws(
  () =>
    parseAfRunManifest(
      JSON.stringify({ ...JSON.parse(serialized), approvals: { ...JSON.parse(serialized).approvals, boundaries_approved: undefined } }),
      "bad.json"
    ),
  /approvals\.boundaries_approved/
);
assert.throws(
  () =>
    parseAfRunManifest(
      JSON.stringify({ ...JSON.parse(serialized), validation: { commands: ["ok", 1], last_result: "passed" } }),
      "bad.json"
    ),
  /validation\.commands/
);
assert.throws(
  () =>
    parseAfRunManifest(
      JSON.stringify({
        ...JSON.parse(serialized),
        approvals: {
          analysis_reviewed: true,
          boundaries_approved: false,
          runtime_contracts_approved: true,
          stub_ready_for_followup: false
        }
      }),
      "bad.json"
    ),
  /runtime_contracts_approved.*boundaries_approved/
);
