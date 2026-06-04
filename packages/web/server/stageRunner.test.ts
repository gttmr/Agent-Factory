import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import fixture from "../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { serializeAfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { ArtifactConflictError, ArtifactRootStore } from "./artifactRootStore.ts";
import {
  applyStageRun,
  type CodexStageRunner,
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

await store.createRoot("req-running-design");
await store.writeArtifact("req-running-design", "analysis-result.json", `${JSON.stringify(fixture, null, 2)}\n`, null);
const runningManifestBefore = await store.readManifest("req-running-design");
await store.writeManifest(
  "req-running-design",
  {
    ...runningManifestBefore.manifest,
    approvals: {
      ...runningManifestBefore.manifest.approvals,
      analysis_reviewed: true
    }
  },
  runningManifestBefore.etag
);
let releaseRunningRunner!: () => void;
let runningRunnerStarted = false;
const runningRunner: CodexStageRunner = {
  async run(input) {
    runningRunnerStarted = true;
    await input.updateMetadata?.({
      backend: "sdk",
      thread_id: "thread-running-design",
      event_count: 1,
      usage: null
    });
    await input.emit({
      phase: "codex_event",
      message: "thread started",
      title: "thread started",
      rawEventType: "thread.started",
      status: "started",
      snippet: "thread-running-design"
    });
    await new Promise<void>((resolve) => {
      releaseRunningRunner = resolve;
    });
    await writeFile(
      join(input.proposedDir, "analysis-result.json"),
      `${JSON.stringify(fixture, null, 2)}\n`,
      "utf8"
    );
    await writeFile(join(input.proposedDir, "boundary-design.md"), "# running design proposal\n", "utf8");
    return {
      backend: "sdk",
      thread_id: "thread-running-design",
      event_count: 2,
      usage: {
        input_tokens: 10,
        cached_input_tokens: 2,
        output_tokens: 4,
        reasoning_output_tokens: 1
      }
    };
  }
};
const runningPromise = runStageSkill({
  repoRoot,
  store,
  reqId: "req-running-design",
  stage: "design",
  body: {
    model: "gpt-5.5"
  },
  codexRunner: runningRunner
});
while (!runningRunnerStarted) {
  await delay(1);
}
const runningRuns = await listStageRuns({ store, reqId: "req-running-design", stage: "design" });
assert.equal(runningRuns.length, 1);
assert.equal(runningRuns[0].status, "running");
assert.equal(runningRuns[0].finished_at, null);
assert.equal(runningRuns[0].codex?.thread_id, "thread-running-design");
const runningDetail = await readStageRunDetail({
  store,
  reqId: "req-running-design",
  stage: "design",
  runId: runningRuns[0].run_id
});
assert.equal(runningDetail.summary.status, "running");
assert.equal(runningDetail.diff_summary.files.length, 0);
assert.equal(runningDetail.proposed_artifacts.length, 0);
assert.ok(runningDetail.events.some((event) => event.phase === "codex_event"));
const runningManifest = await store.readManifest("req-running-design");
assert.equal(runningManifest.manifest.stage_runs?.design?.status, "running");
assert.equal(runningManifest.manifest.stage_runs?.design?.latest_run_id, runningRuns[0].run_id);
await assert.rejects(
  () =>
    runStageSkill({
      repoRoot,
      store,
      reqId: "req-running-design",
      stage: "design",
      body: { model: "gpt-5.5" },
      codexRunner: {
        async run() {
          throw new Error("duplicate design run should not start");
        }
      }
    }),
  /이미 stage run 이 진행 중/
);
releaseRunningRunner();
const completedRunningRun = await runningPromise;
assert.equal(completedRunningRun.status, "completed");
assert.equal(completedRunningRun.codex?.thread_id, "thread-running-design");
const runningManifestAfter = await store.readManifest("req-running-design");
assert.equal(runningManifestAfter.manifest.stage_runs?.design?.status, "completed");

await store.createRoot("req-running-analyze");
let releaseRunningAnalyzeRunner!: () => void;
let runningAnalyzeRunnerStarted = false;
const runningAnalyzeRunner: CodexStageRunner = {
  async run(input) {
    assert.equal(input.stage, "analyze");
    runningAnalyzeRunnerStarted = true;
    await input.updateMetadata?.({
      backend: "sdk",
      thread_id: "thread-running-analyze",
      event_count: 1,
      usage: null
    });
    await input.emit({
      phase: "codex_event",
      message: "thread started",
      title: "thread started",
      rawEventType: "thread.started",
      status: "started",
      snippet: "thread-running-analyze"
    });
    await new Promise<void>((resolve) => {
      releaseRunningAnalyzeRunner = resolve;
    });
    const proposed = {
      ...fixture,
      normalizedRequirement: {
        ...fixture.normalizedRequirement,
        id: "req-running-analyze",
        raw_text: "running analyze requirement"
      }
    };
    await writeFile(join(input.proposedDir, "analysis-result.json"), `${JSON.stringify(proposed, null, 2)}\n`, "utf8");
    return {
      backend: "sdk",
      thread_id: "thread-running-analyze",
      event_count: 2,
      usage: {
        input_tokens: 12,
        cached_input_tokens: 3,
        output_tokens: 5,
        reasoning_output_tokens: 1
      }
    };
  }
};
const runningAnalyzePromise = runStageSkill({
  repoRoot,
  store,
  reqId: "req-running-analyze",
  stage: "analyze",
  body: {
    model: "gpt-5.5",
    input: {
      rawText: "running analyze requirement",
      domain: "공통"
    },
    catalog: []
  },
  codexRunner: runningAnalyzeRunner
});
while (!runningAnalyzeRunnerStarted) {
  await delay(1);
}
const runningAnalyzeRuns = await listStageRuns({ store, reqId: "req-running-analyze", stage: "analyze" });
assert.equal(runningAnalyzeRuns.length, 1);
assert.equal(runningAnalyzeRuns[0].status, "running");
assert.equal(runningAnalyzeRuns[0].finished_at, null);
assert.equal(runningAnalyzeRuns[0].codex?.thread_id, "thread-running-analyze");
const runningAnalyzeDetail = await readStageRunDetail({
  store,
  reqId: "req-running-analyze",
  stage: "analyze",
  runId: runningAnalyzeRuns[0].run_id
});
assert.equal(runningAnalyzeDetail.summary.status, "running");
assert.equal(runningAnalyzeDetail.diff_summary.files.length, 0);
assert.equal(runningAnalyzeDetail.proposed_artifacts.length, 0);
assert.ok(runningAnalyzeDetail.events.some((event) => event.phase === "codex_event"));
const runningAnalyzeManifest = await store.readManifest("req-running-analyze");
assert.equal(runningAnalyzeManifest.manifest.stage_runs?.analyze?.status, "running");
assert.equal(runningAnalyzeManifest.manifest.stage_runs?.analyze?.latest_run_id, runningAnalyzeRuns[0].run_id);
await assert.rejects(
  () =>
    runStageSkill({
      repoRoot,
      store,
      reqId: "req-running-analyze",
      stage: "analyze",
      body: {
        model: "gpt-5.5",
        input: {
          rawText: "duplicate running analyze requirement",
          domain: "공통"
        },
        catalog: []
      },
      codexRunner: {
        async run() {
          throw new Error("duplicate analyze run should not start");
        }
      }
    }),
  /이미 stage run 이 진행 중/
);
releaseRunningAnalyzeRunner();
const completedRunningAnalyzeRun = await runningAnalyzePromise;
assert.equal(completedRunningAnalyzeRun.status, "completed");
assert.equal(completedRunningAnalyzeRun.codex?.thread_id, "thread-running-analyze");
const runningAnalyzeManifestAfter = await store.readManifest("req-running-analyze");
assert.equal(runningAnalyzeManifestAfter.manifest.stage_runs?.analyze?.status, "completed");

await store.createRoot("req-sdk");
await store.writeArtifact("req-sdk", "analysis-result.json", `${JSON.stringify(fixture, null, 2)}\n`, null);
const sdkRunner: CodexStageRunner = {
  async run(input) {
    assert.equal(input.stage, "analyze");
    assert.equal(input.model, "gpt-5.5");
    const proposed = {
      ...fixture,
      normalizedRequirement: {
        ...fixture.normalizedRequirement,
        id: "req-sdk",
        raw_text: "SDK runner proposed requirement"
      }
    };
    await writeFile(join(input.proposedDir, "analysis-result.json"), `${JSON.stringify(proposed, null, 2)}\n`, "utf8");
    await input.emit({
      phase: "codex_event",
      message: "command completed",
      title: "command execution",
      rawEventType: "item.completed",
      itemType: "command_execution",
      status: "completed",
      toolName: "command",
      snippet: "node scripts/example.js"
    });
    return {
      backend: "sdk",
      thread_id: "thread-sdk-001",
      event_count: 3,
      usage: {
        input_tokens: 100,
        cached_input_tokens: 20,
        output_tokens: 30,
        reasoning_output_tokens: 10
      }
    };
  }
};
const sdkAnalyzeRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-sdk",
  stage: "analyze",
  body: {
    model: "gpt-5.5",
    input: {
      rawText: "SDK runner proposed requirement",
      domain: "공통"
    },
    catalog: []
  },
  codexRunner: sdkRunner
});
assert.equal(sdkAnalyzeRun.status, "completed");
assert.deepEqual(sdkAnalyzeRun.codex, {
  backend: "sdk",
  thread_id: "thread-sdk-001",
  event_count: 3,
  usage: {
    input_tokens: 100,
    cached_input_tokens: 20,
    output_tokens: 30,
    reasoning_output_tokens: 10
  }
});
const sdkCanonicalAfterRun = JSON.parse(await readFile(join(repoRoot, "artifacts/af/req-sdk/analysis-result.json"), "utf8"));
assert.equal(sdkCanonicalAfterRun.normalizedRequirement.raw_text, fixture.normalizedRequirement.raw_text);
const sdkDetail = await readStageRunDetail({ store, reqId: "req-sdk", stage: "analyze", runId: sdkAnalyzeRun.run_id });
assert.ok(sdkDetail.events.some((event) => event.phase === "codex_event" && event.itemType === "command_execution"));
const manifestAfterSdkRun = await store.readManifest("req-sdk");
assert.equal(manifestAfterSdkRun.manifest.stage_runs?.analyze?.codex?.backend, "sdk");
assert.equal(manifestAfterSdkRun.manifest.stage_runs?.analyze?.codex?.thread_id, "thread-sdk-001");
assert.equal(manifestAfterSdkRun.manifest.stage_runs?.analyze?.codex?.event_count, 3);
assert.equal("usage" in (manifestAfterSdkRun.manifest.stage_runs?.analyze?.codex ?? {}), false);

await store.createRoot("req-legacy-run");
await store.writeArtifact("req-legacy-run", "analysis-result.json", `${JSON.stringify(fixture, null, 2)}\n`, null);
const legacyRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-legacy-run",
  stage: "analyze",
  body: {
    execution_mode: "fake",
    model: "gpt-5.5",
    input: {
      rawText: "legacy summary without codex metadata",
      domain: "공통"
    },
    catalog: []
  }
});
const legacySummaryPath = join(
  repoRoot,
  `artifacts/af/req-legacy-run/runs/analyze/${legacyRun.run_id}/result-summary.json`
);
const legacySummaryJson = JSON.parse(await readFile(legacySummaryPath, "utf8"));
delete legacySummaryJson.codex;
await writeFile(legacySummaryPath, `${JSON.stringify(legacySummaryJson, null, 2)}\n`, "utf8");
const legacyCurrent = await store.readArtifact("req-legacy-run", "analysis-result.json");
await applyStageRun({
  store,
  reqId: "req-legacy-run",
  stage: "analyze",
  runId: legacyRun.run_id,
  ifMatch: legacyCurrent.etag
});
const legacyManifest = await store.readManifest("req-legacy-run");
assert.equal(legacyManifest.manifest.stage_runs?.analyze?.codex, undefined);

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
let blockedRunnerCalled = false;
const failedDesignRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-blocked",
  stage: "design",
  body: {
    model: "gpt-5.5"
  },
  codexRunner: {
    async run() {
      blockedRunnerCalled = true;
      throw new Error("blocked design run should not start Codex");
    }
  }
});
assert.equal(failedDesignRun.status, "failed");
assert.match(failedDesignRun.last_error ?? "", /analysis_reviewed=true/);
assert.equal(blockedRunnerCalled, false);
assert.deepEqual(failedDesignRun.codex, {
  backend: "sdk",
  thread_id: null,
  event_count: 0,
  usage: null
});
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
