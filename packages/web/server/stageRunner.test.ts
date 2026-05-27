import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { serializeAfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { ArtifactConflictError, ArtifactRootStore } from "./artifactRootStore.ts";
import {
  applyStageRun,
  listStageRuns,
  readStageRunDetail,
  runStageSkill
} from "./stageRunner.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-stage-runner-"));
const store = new ArtifactRootStore({ repoRoot });

await store.createRoot("req-001");
await store.writeArtifact("req-001", "analysis-result.json", `${JSON.stringify(fixture, null, 2)}\n`, null);

const manifestBefore = await store.readManifest("req-001");
await store.writeManifest(
  "req-001",
  {
    ...manifestBefore.manifest,
    approvals: {
      ...manifestBefore.manifest.approvals,
      analysis_reviewed: true
    }
  },
  manifestBefore.etag
);

const analyzeRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "analyze",
  body: {
    execution_mode: "fake",
    model: "gpt-5.5",
    input: {
      rawText: "고객 문의를 분류하고 한 문장으로 요약한다.",
      domain: "공통"
    },
    catalog: []
  }
});

assert.equal(analyzeRun.stage, "analyze");
assert.equal(analyzeRun.status, "completed");
assert.match(analyzeRun.run_id, /^\d{8}T\d{6}Z-analyze-[a-f0-9]{6}$/);
assert.deepEqual(analyzeRun.output_artifacts, [
  `runs/analyze/${analyzeRun.run_id}/proposed-artifacts/analysis-result.json`
]);

const canonicalAfterRun = JSON.parse(await readFile(join(repoRoot, "artifacts/af/req-001/analysis-result.json"), "utf8"));
assert.equal(canonicalAfterRun.normalizedRequirement.raw_text, fixture.normalizedRequirement.raw_text);

const analyzeDetail = await readStageRunDetail({ store, reqId: "req-001", stage: "analyze", runId: analyzeRun.run_id });
assert.equal(analyzeDetail.summary.status, "completed");
assert.equal(analyzeDetail.proposed_artifacts[0].path, "proposed-artifacts/analysis-result.json");
assert.equal(analyzeDetail.diff_summary.files[0].status, "changed");
assert.ok(analyzeDetail.events.some((event) => event.phase === "completed"));

const runs = await listStageRuns({ store, reqId: "req-001", stage: "analyze" });
assert.equal(runs.length, 1);
assert.equal(runs[0].run_id, analyzeRun.run_id);

const staleEtag = "not-the-current-etag";
await assert.rejects(
  () =>
    applyStageRun({
      store,
      reqId: "req-001",
      stage: "analyze",
      runId: analyzeRun.run_id,
      ifMatch: staleEtag
    }),
  ArtifactConflictError
);

const current = await store.readArtifact("req-001", "analysis-result.json");
const applied = await applyStageRun({
  store,
  reqId: "req-001",
  stage: "analyze",
  runId: analyzeRun.run_id,
  ifMatch: current.etag
});
assert.deepEqual(applied.applied_artifacts, ["analysis-result.json"]);
const canonicalAfterApply = JSON.parse(await readFile(join(repoRoot, "artifacts/af/req-001/analysis-result.json"), "utf8"));
assert.equal(canonicalAfterApply.normalizedRequirement.raw_text, "고객 문의를 분류하고 한 문장으로 요약한다.");

const manifestAfterApply = await store.readManifest("req-001");
assert.equal(manifestAfterApply.manifest.approvals.analysis_reviewed, true);
assert.equal(manifestAfterApply.manifest.approvals.boundaries_approved, false);

const designRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "design",
  body: {
    execution_mode: "fake",
    model: "gpt-5.5"
  }
});
assert.equal(designRun.stage, "design");
assert.deepEqual(designRun.output_artifacts, [
  `runs/design/${designRun.run_id}/proposed-artifacts/analysis-result.json`,
  `runs/design/${designRun.run_id}/proposed-artifacts/boundary-design.md`
]);

const boundaryDesign = await readFile(
  join(repoRoot, `artifacts/af/req-001/runs/design/${designRun.run_id}/proposed-artifacts/boundary-design.md`),
  "utf8"
);
assert.match(boundaryDesign, /af-design-boundaries/);

const manifestAfterDesignRun = await store.readManifest("req-001");
assert.equal(manifestAfterDesignRun.manifest.approvals.boundaries_approved, false);
assert.equal(manifestAfterDesignRun.manifest.approvals.runtime_contracts_approved, false);
assert.equal(manifestAfterDesignRun.manifest.stage_runs?.design?.latest_run_id, designRun.run_id);

await assert.rejects(
  () =>
    runStageSkill({
      repoRoot,
      store,
      reqId: "req-001",
      stage: "build",
      body: { execution_mode: "fake", model: "gpt-5.5" }
    }),
  /지원하지 않는 stage/
);

await store.createRoot("req-blocked");
await store.writeArtifact("req-blocked", "analysis-result.json", `${JSON.stringify(fixture, null, 2)}\n`, null);
const failedDesignRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-blocked",
  stage: "design",
  body: {
    execution_mode: "fake",
    model: "gpt-5.5"
  }
});
assert.equal(failedDesignRun.status, "failed");
assert.match(failedDesignRun.last_error ?? "", /analysis_reviewed=true/);
const failedDetail = await readStageRunDetail({
  store,
  reqId: "req-blocked",
  stage: "design",
  runId: failedDesignRun.run_id
});
assert.equal(failedDetail.diff_summary.files.length, 0);
assert.match(failedDetail.diagnostics ?? "", /analysis_reviewed=true/);
const blockedCanonical = JSON.parse(await readFile(join(repoRoot, "artifacts/af/req-blocked/analysis-result.json"), "utf8"));
assert.equal(blockedCanonical.normalizedRequirement.raw_text, fixture.normalizedRequirement.raw_text);

await rm(repoRoot, { recursive: true, force: true });
