import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fixture from "../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { serializeAfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { ArtifactConflictError, ArtifactRootStore } from "./artifactRootStore.ts";
import {
  applyStageRun,
  type CodexStageRunner,
  type StagePrimitiveRunner,
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

await mkdir(join(repoRoot, "catalog"), { recursive: true });
await writeFile(
  join(repoRoot, "catalog/agents.yaml"),
  [
    "agents:",
    "  - id: cat-required-page-agent",
    "    name: Required Page Agent",
    "    agent_kind: specialist",
    "    status: approved"
  ].join("\n"),
  "utf8"
);
await writeFile(join(repoRoot, "catalog/workflows.yaml"), "workflows: []\n", "utf8");
await writeFile(join(repoRoot, "catalog/adapters.yaml"), "adapters: []\n", "utf8");
await writeFile(join(repoRoot, "catalog/remote-a2a-contracts.yaml"), "remote_a2a_contracts: []\n", "utf8");
await store.createRoot("req-catalog-hydrated");
await store.writeArtifact("req-catalog-hydrated", "analysis-result.json", `${JSON.stringify(fixture, null, 2)}\n`, null);
const catalogHydratedRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-catalog-hydrated",
  stage: "analyze",
  body: {
    execution_mode: "fake",
    model: "gpt-5.5"
  }
});
assert.equal(catalogHydratedRun.catalog_context?.source, "server_default");
assert.equal(catalogHydratedRun.catalog_context?.count, 1);
const catalogHydratedDetail = await readStageRunDetail({
  store,
  reqId: "req-catalog-hydrated",
  stage: "analyze",
  runId: catalogHydratedRun.run_id
});
assert.match(JSON.stringify(catalogHydratedDetail.request), /cat-required-page-agent/);
assert.match(JSON.stringify(catalogHydratedDetail.request), /"source":"server_default"/);

const primitiveRunner: StagePrimitiveRunner = {
  async build(input) {
    assert.equal(input.stage, "build");
    assert.equal(input.model, "gpt-5.5");
    await input.emit({
      phase: "process_event",
      title: "stdout",
      message: "runtime-stub build completed",
      snippet: "generated req_001_adk/agent.py"
    });
    const packageDir = join(input.rootDir, "runtime-stub/req_001_adk");
    await mkdir(packageDir, { recursive: true });
    await writeFile(join(packageDir, "agent.py"), "root_agent = object()\n", "utf8");
    return {
      ok: true,
      command: "node scripts/generate-adk-source.mjs",
      stdout: "runtime-stub build completed",
      stderr: "",
      files: [{ path: "req_001_adk/agent.py", bytes: 22 }]
    };
  },
  async verify(input) {
    assert.equal(input.stage, "verify");
    assert.equal(input.commandKey, "test_analyzer");
    await input.emit({
      phase: "process_event",
      title: "stderr",
      message: "analyzer regression failed",
      snippet: "expected test failure"
    });
    return {
      ok: false,
      exit_code: 1,
      command: "npm run test:analyzer --prefix packages/web",
      command_key: "test_analyzer",
      stdout: "",
      stderr: "expected test failure"
    };
  }
};

const buildRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "build",
  body: { execution_mode: "fake", model: "gpt-5.5" },
  primitiveRunner
});
assert.equal(buildRun.stage, "build");
assert.equal(buildRun.status, "completed");
assert.match(buildRun.run_id, /^\d{8}T\d{6}Z-build-[a-f0-9]{6}$/);
assert.deepEqual(buildRun.output_artifacts, ["runtime-stub/req_001_adk/agent.py"]);
const buildDetail = await readStageRunDetail({ store, reqId: "req-001", stage: "build", runId: buildRun.run_id });
assert.equal(buildDetail.diff_summary.files.length, 0);
assert.ok(buildDetail.events.some((event) => event.phase === "process_event"));

const verifyRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "verify",
  body: { model: "gpt-5.5", verifyCommand: "test_analyzer" },
  primitiveRunner
});
assert.equal(verifyRun.stage, "verify");
assert.equal(verifyRun.status, "completed");
assert.equal(verifyRun.validation.ok, false);
assert.deepEqual(verifyRun.validation.errors, ["verify command failed with exit code 1"]);
assert.deepEqual(verifyRun.output_artifacts, [
  `runs/verify/${verifyRun.run_id}/proposed-artifacts/validation-report.md`,
  `runs/verify/${verifyRun.run_id}/proposed-artifacts/catalog-delta.yaml`
]);
const verifyDetail = await readStageRunDetail({ store, reqId: "req-001", stage: "verify", runId: verifyRun.run_id });
assert.deepEqual(
  verifyDetail.diff_summary.files.map((file) => file.path),
  ["validation-report.md", "catalog-delta.yaml"]
);
assert.match(verifyDetail.proposed_artifacts[0].preview, /test_analyzer/);
assert.match(verifyDetail.proposed_artifacts[1].preview, /proposed_additions: \[\]/);

const abortController = new AbortController();
abortController.abort();
const canceledRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "build",
  body: { model: "gpt-5.5" },
  primitiveRunner,
  signal: abortController.signal
});
assert.equal(canceledRun.status, "canceled");
assert.equal(canceledRun.output_artifacts.length, 0);

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
