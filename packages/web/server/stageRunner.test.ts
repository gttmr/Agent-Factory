import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import fixture from "../../../templates/regression-scenarios/scenario-a-simple-local-specialist/analysis-result.json" with { type: "json" };
import { serializeAfRunManifest, type AfRunManifest } from "../src/analyzer/afRunManifest.ts";
import {
  ArtifactConflictError,
  ArtifactRootStore,
  ArtifactValidationError,
  type ArtifactWriteResult
} from "./artifactRootStore.ts";
import { writeManifestValidationResult } from "./manifestValidation.ts";
import {
  applyStageRun,
  type CodexStageRunner,
  type StagePrimitiveRunner,
  listStageRuns,
  readStageRunDetail,
  runStageSkill
} from "./stageRunner.ts";

const execFileAsync = promisify(execFile);
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

class BatchRaceStore extends ArtifactRootStore {
  private injected = false;
  private readonly afterPreflight: () => Promise<void>;

  constructor(repoRoot: string, afterPreflight: () => Promise<void>) {
    super({ repoRoot });
    this.afterPreflight = afterPreflight;
  }

  override async writeArtifact(
    reqId: string,
    relative: string,
    content: string,
    ifMatch?: string | null
  ): Promise<ArtifactWriteResult> {
    if (!this.injected && relative === "validation-report.md") {
      this.injected = true;
      await this.afterPreflight();
    }
    return await super.writeArtifact(reqId, relative, content, ifMatch);
  }
}

class ManifestWriteBarrierStore extends ArtifactRootStore {
  private armed = false;
  private blocked = false;
  private readonly writeBlocked = deferred();
  private readonly releaseWrite = deferred();

  constructor(repoRoot: string) {
    super({ repoRoot });
  }

  arm(): void {
    this.armed = true;
  }

  async waitUntilWriteBlocked(): Promise<void> {
    await this.writeBlocked.promise;
  }

  release(): void {
    this.releaseWrite.resolve();
  }

  override async writeArtifact(
    reqId: string,
    relative: string,
    content: string,
    ifMatch?: string | null
  ): Promise<ArtifactWriteResult> {
    if (this.armed && !this.blocked && relative === "af-run-manifest.json") {
      this.blocked = true;
      this.writeBlocked.resolve();
      await this.releaseWrite.promise;
    }
    return await super.writeArtifact(reqId, relative, content, ifMatch);
  }
}

class FailingCanonicalBatchStore extends ArtifactRootStore {
  private armed = false;
  private failed = false;

  constructor(repoRoot: string) {
    super({ repoRoot });
  }

  arm(): void {
    this.armed = true;
  }

  override async writeArtifact(
    reqId: string,
    relative: string,
    content: string,
    ifMatch?: string | null
  ): Promise<ArtifactWriteResult> {
    if (this.armed && !this.failed && relative === "boundary-design.md") {
      this.failed = true;
      throw new Error("injected boundary-design write failure");
    }
    return await super.writeArtifact(reqId, relative, content, ifMatch);
  }
}

const fixtureFor = (reqId: string) => ({
  ...fixture,
  normalizedRequirement: { ...fixture.normalizedRequirement, id: reqId },
  assetCandidates: fixture.assetCandidates.map((candidate) => ({ ...candidate, source_requirement_id: reqId })),
  graph: { ...fixture.graph, source_requirement_id: reqId }
});

const repoRoot = await mkdtemp(join(tmpdir(), "af-stage-runner-"));
await execFileAsync("git", ["init"], { cwd: repoRoot });
const store = new ArtifactRootStore({ repoRoot });

async function setApprovals(reqId: string, approvals: AfRunManifest["approvals"]): Promise<void> {
  await store.withCanonicalWriteLock(reqId, async () => {
    const { manifest } = await store.readManifest(reqId);
    await store.writeManifest(reqId, { ...manifest, approvals }, null);
  });
}

async function revokeApprovals(reqId: string): Promise<void> {
  await store.withCanonicalWriteLock(reqId, async () => {
    const { manifest } = await store.readManifest(reqId);
    await store.writeManifest(
      reqId,
      {
        ...manifest,
        approvals: {
          analysis_reviewed: false,
          boundaries_approved: false,
          runtime_contracts_approved: false,
          stub_ready_for_followup: false
        }
      },
      null
    );
  });
}

async function assertBuildBlocked(reqId: string): Promise<void> {
  let buildCalled = false;
  const buildRun = await runStageSkill({
    repoRoot,
    store,
    reqId,
    stage: "build",
    body: { model: "gpt-5.5" },
    primitiveRunner: {
      async build() {
        buildCalled = true;
        return {
          ok: true,
          command: "injected build",
          stdout: "",
          stderr: "",
          files: []
        };
      },
      async verify() {
        throw new Error("verify should not run");
      }
    }
  });
  assert.equal(buildCalled, false);
  assert.equal(buildRun.status, "failed");
  assert.match(buildRun.last_error ?? "", /boundaries_approved|runtime_contracts_approved/);
}

async function reproduceManifestValidationApprovalRace(): Promise<void> {
  const reqId = "req-validation-race";
  await store.createRoot(reqId);
  await setApprovals(reqId, {
    analysis_reviewed: true,
    boundaries_approved: true,
    runtime_contracts_approved: true,
    stub_ready_for_followup: true
  });

  const racingStore = new ManifestWriteBarrierStore(repoRoot);
  racingStore.arm();
  const validationWrite = writeManifestValidationResult(racingStore, reqId, "narrow validation", true);
  await racingStore.waitUntilWriteBlocked();
  const revocation = revokeApprovals(reqId);
  racingStore.release();
  await Promise.all([validationWrite, revocation]);

  const { manifest } = await store.readManifest(reqId);
  assert.deepEqual(manifest.approvals, {
    analysis_reviewed: false,
    boundaries_approved: false,
    runtime_contracts_approved: false,
    stub_ready_for_followup: false
  });
  assert.equal(manifest.validation.last_result, "passed");
  await assertBuildBlocked(reqId);
}

async function reproduceStageRunManifestApprovalRace(): Promise<void> {
  const reqId = "req-stage-run-race";
  await store.createRoot(reqId);
  await store.writeArtifact(reqId, "analysis-result.json", `${JSON.stringify(fixtureFor(reqId), null, 2)}\n`, null);
  await setApprovals(reqId, {
    analysis_reviewed: true,
    boundaries_approved: true,
    runtime_contracts_approved: true,
    stub_ready_for_followup: true
  });

  const racingStore = new ManifestWriteBarrierStore(repoRoot);
  racingStore.arm();
  const stageRun = runStageSkill({
    repoRoot,
    store: racingStore,
    reqId,
    stage: "analyze",
    body: {
      execution_mode: "fake",
      model: "gpt-5.5",
      input: { rawText: "approval race", domain: "공통" },
      catalog: []
    }
  });
  await racingStore.waitUntilWriteBlocked();
  const revocation = revokeApprovals(reqId);
  racingStore.release();
  const [stageRunSummary] = await Promise.all([stageRun, revocation]);

  const { manifest } = await store.readManifest(reqId);
  assert.deepEqual(manifest.approvals, {
    analysis_reviewed: false,
    boundaries_approved: false,
    runtime_contracts_approved: false,
    stub_ready_for_followup: false
  });
  assert.equal(manifest.stage_runs?.analyze?.latest_run_id, stageRunSummary.run_id);
  await assertBuildBlocked(reqId);
}

async function reproduceCanonicalBatchFailure(): Promise<void> {
  const reqId = "req-atomic-design";
  await store.createRoot(reqId);
  const canonicalAnalysis = `${JSON.stringify(fixtureFor(reqId), null, 2)}\n`;
  const canonicalBoundary = "# Reviewed boundary\n\nOriginal reviewed content.\n";
  await store.writeArtifact(reqId, "analysis-result.json", canonicalAnalysis, null);
  await store.writeArtifact(reqId, "boundary-design.md", canonicalBoundary, null);
  await setApprovals(reqId, {
    analysis_reviewed: true,
    boundaries_approved: true,
    runtime_contracts_approved: true,
    stub_ready_for_followup: true
  });

  const designRunner: CodexStageRunner = {
    async run(input) {
      const proposed = fixtureFor(reqId);
      proposed.evidence = {
        ...proposed.evidence,
        assumptions: [...proposed.evidence.assumptions, "unreviewed batch proposal"]
      };
      await writeFile(join(input.proposedDir, "analysis-result.json"), `${JSON.stringify(proposed, null, 2)}\n`, "utf8");
      await writeFile(join(input.proposedDir, "boundary-design.md"), "# Proposed boundary\n\nUnreviewed content.\n", "utf8");
      return { backend: "sdk", thread_id: "thread-atomic-design", event_count: 0 };
    }
  };
  const designRun = await runStageSkill({
    repoRoot,
    store,
    reqId,
    stage: "design",
    body: { model: "gpt-5.5", catalog: [] },
    codexRunner: designRunner
  });
  assert.equal(designRun.status, "completed");

  const failingStore = new FailingCanonicalBatchStore(repoRoot);
  failingStore.arm();
  await assert.rejects(
    () => applyStageRun({ store: failingStore, reqId, stage: "design", runId: designRun.run_id }),
    /injected boundary-design write failure/
  );

  assert.equal(await readFile(join(repoRoot, `artifacts/af/${reqId}/analysis-result.json`), "utf8"), canonicalAnalysis);
  assert.equal(await readFile(join(repoRoot, `artifacts/af/${reqId}/boundary-design.md`), "utf8"), canonicalBoundary);
  const { manifest } = await store.readManifest(reqId);
  assert.equal(manifest.approvals.boundaries_approved, false);
  assert.equal(manifest.approvals.runtime_contracts_approved, false);
  assert.equal(manifest.approvals.stub_ready_for_followup, false);
  await assertBuildBlocked(reqId);

  const retriedApply = await applyStageRun({ store, reqId, stage: "design", runId: designRun.run_id });
  assert.deepEqual(retriedApply.applied_artifacts, ["analysis-result.json", "boundary-design.md"]);
  const retriedManifest = await store.readManifest(reqId);
  assert.equal(retriedManifest.manifest.approvals.boundaries_approved, false);
  assert.equal(retriedManifest.manifest.approvals.runtime_contracts_approved, false);
}

const blockerReproductions: Array<[string, () => Promise<void>]> = [
  ["manifest validation approval race", reproduceManifestValidationApprovalRace],
  ["stage run manifest approval race", reproduceStageRunManifestApprovalRace],
  ["canonical batch failure", reproduceCanonicalBatchFailure]
];
const blockerFailures: Error[] = [];
for (const [name, reproduce] of blockerReproductions) {
  try {
    await reproduce();
  } catch (error) {
    blockerFailures.push(new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }));
  }
}
if (blockerFailures.length) {
  throw new AggregateError(blockerFailures, "Stage Runner blocker reproductions failed");
}

await store.createRoot("req-001");
await store.writeArtifact("req-001", "analysis-result.json", `${JSON.stringify(fixtureFor("req-001"), null, 2)}\n`, null);

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
assert.equal(analyzeRun.skill_name, "af-discover-assets");
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
assert.equal(manifestAfterApply.manifest.approvals.analysis_reviewed, false);
assert.equal(manifestAfterApply.manifest.approvals.boundaries_approved, false);
await store.writeManifest(
  "req-001",
  {
    ...manifestAfterApply.manifest,
    approvals: {
      ...manifestAfterApply.manifest.approvals,
      analysis_reviewed: true
    },
    stages: {
      ...manifestAfterApply.manifest.stages,
      analyze: { ...manifestAfterApply.manifest.stages.analyze, status: "complete" }
    }
  },
  manifestAfterApply.etag
);

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
assert.equal(designRun.skill_name, "af-compose-solution");
assert.deepEqual(designRun.output_artifacts, [
  `runs/design/${designRun.run_id}/proposed-artifacts/analysis-result.json`,
  `runs/design/${designRun.run_id}/proposed-artifacts/boundary-design.md`
]);

const boundaryDesign = await readFile(
  join(repoRoot, `artifacts/af/req-001/runs/design/${designRun.run_id}/proposed-artifacts/boundary-design.md`),
  "utf8"
);
assert.match(boundaryDesign, /af-compose-solution/);

const manifestAfterDesignRun = await store.readManifest("req-001");
assert.equal(manifestAfterDesignRun.manifest.approvals.boundaries_approved, false);
assert.equal(manifestAfterDesignRun.manifest.approvals.runtime_contracts_approved, false);
assert.equal(manifestAfterDesignRun.manifest.stage_runs?.design?.latest_run_id, designRun.run_id);

const canonicalBeforeProposalMutation = await readFile(
  join(repoRoot, "artifacts/af/req-001/analysis-result.json"),
  "utf8"
);
await writeFile(
  join(repoRoot, `artifacts/af/req-001/runs/design/${designRun.run_id}/proposed-artifacts/analysis-result.json`),
  '{"contract_version":"2.0"}\n',
  "utf8"
);
await assert.rejects(
  () => applyStageRun({ store, reqId: "req-001", stage: "design", runId: designRun.run_id }),
  (error: unknown) => {
    assert.ok(error instanceof ArtifactValidationError);
    assert.match(error.message, /analysis-result\.json/);
    assert.match(error.message, /ETag/);
    assert.match(error.message, /검증 실패/);
    return true;
  }
);
assert.equal(
  await readFile(join(repoRoot, "artifacts/af/req-001/analysis-result.json"), "utf8"),
  canonicalBeforeProposalMutation
);
await assert.rejects(
  () => store.readArtifact("req-001", "boundary-design.md"),
  (error: unknown) => error instanceof ArtifactValidationError && error.statusCode === 404
);

await store.createRoot("req-partial-design");
await store.writeArtifact(
  "req-partial-design",
  "analysis-result.json",
  `${JSON.stringify(fixtureFor("req-partial-design"), null, 2)}\n`,
  null
);
const partialDesignManifest = await store.readManifest("req-partial-design");
await store.writeManifest(
  "req-partial-design",
  {
    ...partialDesignManifest.manifest,
    approvals: {
      ...partialDesignManifest.manifest.approvals,
      analysis_reviewed: true
    }
  },
  partialDesignManifest.etag
);
const partialDesignRunner: CodexStageRunner = {
  async run(input) {
    assert.equal(input.stage, "design");
    await writeFile(
      join(input.proposedDir, "analysis-result.json"),
      `${JSON.stringify(fixtureFor("req-partial-design"), null, 2)}\n`,
      "utf8"
    );
    return {
      backend: "sdk",
      thread_id: "thread-partial-design",
      event_count: 0
    };
  }
};
const partialDesignRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-partial-design",
  stage: "design",
  body: { model: "gpt-5.5" },
  codexRunner: partialDesignRunner
});
assert.equal(partialDesignRun.status, "failed");
assert.match(partialDesignRun.last_error ?? "", /필수 proposed artifact가 누락되었습니다: boundary-design\.md/);
const partialDesignDetail = await readStageRunDetail({
  store,
  reqId: "req-partial-design",
  stage: "design",
  runId: partialDesignRun.run_id
});
assert.deepEqual(partialDesignDetail.diff_summary.files, []);
assert.match(partialDesignDetail.diagnostics ?? "", /필수 proposed artifact가 누락되었습니다: boundary-design\.md/);

await store.createRoot("req-sdk");
await store.writeArtifact("req-sdk", "analysis-result.json", `${JSON.stringify(fixtureFor("req-sdk"), null, 2)}\n`, null);
const sdkRunner: CodexStageRunner = {
  async run(input) {
    assert.equal(input.stage, "analyze");
    assert.equal(input.model, "gpt-5.5");
    const sdkFixture = fixtureFor("req-sdk");
    const proposed = {
      ...sdkFixture,
      normalizedRequirement: {
        ...sdkFixture.normalizedRequirement,
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

const guardedRepoRoot = await mkdtemp(join(tmpdir(), "af-stage-runner-guard-"));
await execFileAsync("git", ["init"], { cwd: guardedRepoRoot });
await writeFile(join(guardedRepoRoot, ".gitignore"), "artifacts/\n.env*.local\n", "utf8");
await writeFile(join(guardedRepoRoot, "tracked-dirty.ts"), "export const value = 'staged';\n", "utf8");
await execFileAsync("git", ["add", ".gitignore", "tracked-dirty.ts"], { cwd: guardedRepoRoot });
await writeFile(join(guardedRepoRoot, "tracked-dirty.ts"), "export const value = 'dirty-before-run';\n", "utf8");
await writeFile(join(guardedRepoRoot, "existing-untracked.txt"), "untracked before run\n", "utf8");
await writeFile(join(guardedRepoRoot, ".env.local"), "IGNORED_VALUE=before\n", "utf8");
await writeFile(join(guardedRepoRoot, ".env.deleted.local"), "DELETE_ME=before\n", "utf8");
const guardedStore = new ArtifactRootStore({ repoRoot: guardedRepoRoot });
await guardedStore.createRoot("req-guarded");
await guardedStore.writeArtifact(
  "req-guarded",
  "analysis-result.json",
  `${JSON.stringify(fixtureFor("req-guarded"), null, 2)}\n`,
  null
);

const safeDirtyRunner: CodexStageRunner = {
  async run(input) {
    const guardedFixture = fixtureFor("req-guarded");
    const proposed = {
      ...guardedFixture,
      normalizedRequirement: {
        ...guardedFixture.normalizedRequirement,
        id: "req-guarded",
        raw_text: "pre-existing dirty files remain untouched"
      }
    };
    await writeFile(join(input.proposedDir, "analysis-result.json"), `${JSON.stringify(proposed, null, 2)}\n`, "utf8");
    await writeFile(join(input.runDir, "codex-events.jsonl"), "{\"type\":\"thread.started\"}\n", "utf8");
    await input.emit({ phase: "codex_event", message: "safe event", rawEventType: "thread.started" });
    return { backend: "sdk", thread_id: "thread-guard-safe", event_count: 0 };
  }
};
const safeDirtyRun = await runStageSkill({
  repoRoot: guardedRepoRoot,
  store: guardedStore,
  reqId: "req-guarded",
  stage: "analyze",
  body: { model: "gpt-5.5", catalog: [] },
  codexRunner: safeDirtyRunner
});
assert.equal(safeDirtyRun.status, "completed");

const violatingRunner: CodexStageRunner = {
  async run(input) {
    const guardedFixture = fixtureFor("req-guarded");
    const proposed = {
      ...guardedFixture,
      normalizedRequirement: {
        ...guardedFixture.normalizedRequirement,
        id: "req-guarded",
        raw_text: "writes outside proposed artifacts must fail"
      }
    };
    await writeFile(join(input.proposedDir, "analysis-result.json"), `${JSON.stringify(proposed, null, 2)}\n`, "utf8");
    await writeFile(join(input.repoRoot, "tracked-dirty.ts"), "export const value = 'mutated-by-run';\n", "utf8");
    await writeFile(join(input.repoRoot, "existing-untracked.txt"), "untracked changed by run\n", "utf8");
    await writeFile(join(input.repoRoot, "new-untracked.txt"), "created by run\n", "utf8");
    await writeFile(join(input.repoRoot, ".env.local"), "IGNORED_VALUE=mutated-by-run\n", "utf8");
    await rm(join(input.repoRoot, ".env.deleted.local"));
    await writeFile(join(input.rootDir, "analysis-result.json"), "{\"mutated\":true}\n", "utf8");
    return { backend: "sdk", thread_id: "thread-guard-violation", event_count: 0 };
  }
};
const guardedViolationRun = await runStageSkill({
  repoRoot: guardedRepoRoot,
  store: guardedStore,
  reqId: "req-guarded",
  stage: "analyze",
  body: { model: "gpt-5.5", catalog: [] },
  codexRunner: violatingRunner
});
assert.equal(guardedViolationRun.status, "failed");
assert.match(guardedViolationRun.last_error ?? "", /proposed-artifacts 밖의 워크트리 변경/);
assert.match(guardedViolationRun.last_error ?? "", /tracked-dirty\.ts/);
assert.match(guardedViolationRun.last_error ?? "", /existing-untracked\.txt/);
assert.match(guardedViolationRun.last_error ?? "", /new-untracked\.txt/);
assert.match(guardedViolationRun.last_error ?? "", /modified: \.env\.local/);
assert.match(guardedViolationRun.last_error ?? "", /deleted: \.env\.deleted\.local/);
assert.match(guardedViolationRun.last_error ?? "", /artifacts\/af\/req-guarded\/analysis-result\.json/);

await mkdir(join(repoRoot, "catalog"), { recursive: true });
await writeFile(
  join(repoRoot, "catalog/agents.yaml"),
  [
    "agents:",
    "  - asset_id: cat-required-page-agent",
    "    asset_type: agent",
    "    name: Required Page Agent",
    "    domain_scope: domain_neutral",
    "    business_domains: []",
    "    owner: platform",
    "    reuse_status: reuse_existing",
    "    capability_tags: []",
    "    binding: null",
    "    connection: null",
    "    workflow_profile: null",
    "    exposure: null",
    "    status: approved"
  ].join("\n"),
  "utf8"
);
await writeFile(join(repoRoot, "catalog/workflows.yaml"), "workflows: []\n", "utf8");
await writeFile(join(repoRoot, "catalog/tools.yaml"), "tools: []\n", "utf8");
await store.createRoot("req-catalog-hydrated");
await store.writeArtifact(
  "req-catalog-hydrated",
  "analysis-result.json",
  `${JSON.stringify(fixtureFor("req-catalog-hydrated"), null, 2)}\n`,
  null
);
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

await store.createRoot("req-build-unapproved");
let unapprovedBuildCalled = false;
const unapprovedBuildRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-build-unapproved",
  stage: "build",
  body: { execution_mode: "fake", model: "gpt-5.5" },
  primitiveRunner: {
    ...primitiveRunner,
    async build(input) {
      unapprovedBuildCalled = true;
      return await primitiveRunner.build(input);
    }
  }
});
assert.equal(unapprovedBuildRun.status, "failed");
assert.equal(unapprovedBuildCalled, false);
assert.match(unapprovedBuildRun.last_error ?? "", /boundaries_approved/);
assert.match(unapprovedBuildRun.last_error ?? "", /runtime_contracts_approved/);

const manifestBeforeBuild = await store.readManifest("req-001");
await store.writeManifest(
  "req-001",
  {
    ...manifestBeforeBuild.manifest,
    approvals: {
      ...manifestBeforeBuild.manifest.approvals,
      boundaries_approved: true,
      runtime_contracts_approved: true
    }
  },
  manifestBeforeBuild.etag
);

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
assert.equal(buildRun.skill_name, "af-scaffold-runtime");
assert.match(buildRun.run_id, /^\d{8}T\d{6}Z-build-[a-f0-9]{6}$/);
assert.deepEqual(buildRun.output_artifacts, ["runtime-stub/req_001_adk/agent.py"]);
const buildDetail = await readStageRunDetail({ store, reqId: "req-001", stage: "build", runId: buildRun.run_id });
assert.equal(buildDetail.diff_summary.files.length, 0);
assert.ok(buildDetail.events.some((event) => event.phase === "process_event"));
const manifestBeforeVerify = await store.readManifest("req-001");
await store.writeManifest(
  "req-001",
  {
    ...manifestBeforeVerify.manifest,
    approvals: {
      ...manifestBeforeVerify.manifest.approvals,
      stub_ready_for_followup: true
    },
    stages: {
      ...manifestBeforeVerify.manifest.stages,
      build: { ...manifestBeforeVerify.manifest.stages.build, status: "complete" }
    }
  },
  manifestBeforeVerify.etag
);

const reviewedCatalogDelta = [
  "proposed_additions:",
  "  - asset_type: tool",
  "    asset_id: reviewed-tool",
  "proposed_updates: []",
  "notes:",
  "  - reviewer-approved baseline"
].join("\n");
await store.writeArtifact("req-001", "catalog-delta.yaml", reviewedCatalogDelta, null);

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
assert.equal(verifyRun.skill_name, "af-verify-runtime");
assert.equal(verifyRun.validation.ok, false);
assert.deepEqual(verifyRun.validation.errors, ["verify command failed with exit code 1"]);
const manifestAfterFailedVerify = await store.readManifest("req-001");
assert.equal(manifestAfterFailedVerify.manifest.current_stage, "verify");
assert.equal(manifestAfterFailedVerify.manifest.stages.verify.status, "blocked");
assert.equal(manifestAfterFailedVerify.manifest.validation.last_result, "failed");
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

const failedVerifyApply = await applyStageRun({
  store,
  reqId: "req-001",
  stage: "verify",
  runId: verifyRun.run_id
});
assert.deepEqual(failedVerifyApply.applied_artifacts, ["validation-report.md"]);
assert.deepEqual(failedVerifyApply.skipped_artifacts, [
  {
    path: "catalog-delta.yaml",
    reason: "필수 Verify evidence가 모두 통과한 최신 run이 아니므로 Catalog 변경은 적용할 수 없습니다."
  }
]);
assert.match(await readFile(join(repoRoot, "artifacts/af/req-001/validation-report.md"), "utf8"), /result: failed/);
assert.equal(await readFile(join(repoRoot, "artifacts/af/req-001/catalog-delta.yaml"), "utf8"), reviewedCatalogDelta);

const successfulVerifyRunner: StagePrimitiveRunner = {
  build: primitiveRunner.build,
  async verify(input) {
    const commands = {
      validate_artifact_root: "node scripts/validate-artifacts.mjs",
      validate_generated_runtime: "node scripts/validate-generated-runtime.mjs",
      test_analyzer: "npm run test:analyzer --prefix packages/web"
    } as const;
    return {
      ok: true,
      exit_code: 0,
      command: commands[input.commandKey],
      command_key: input.commandKey,
      stdout: "validation passed",
      stderr: ""
    };
  }
};
const successfulVerifyRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "verify",
  body: { model: "gpt-5.5", verifyCommand: "validate_artifact_root" },
  primitiveRunner: successfulVerifyRunner
});
assert.equal(successfulVerifyRun.validation.ok, true);
const manifestAfterSuccessfulVerify = await store.readManifest("req-001");
assert.equal(manifestAfterSuccessfulVerify.manifest.current_stage, "verify");
assert.equal(manifestAfterSuccessfulVerify.manifest.stages.verify.status, "blocked");
assert.equal(manifestAfterSuccessfulVerify.manifest.validation.last_result, "failed");
assert.ok(
  manifestAfterSuccessfulVerify.manifest.validation.commands.some((command) =>
    command.startsWith("[validate_artifact_root] passed:")
  )
);

const incompleteVerifyApply = await applyStageRun({
  store,
  reqId: "req-001",
  stage: "verify",
  runId: successfulVerifyRun.run_id
});
assert.deepEqual(incompleteVerifyApply.applied_artifacts, ["validation-report.md"]);
assert.deepEqual(incompleteVerifyApply.skipped_artifacts, [
  {
    path: "catalog-delta.yaml",
    reason: "필수 Verify evidence가 모두 통과한 최신 run이 아니므로 Catalog 변경은 적용할 수 없습니다."
  }
]);

const repairedAnalyzerRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "verify",
  body: { model: "gpt-5.5", verifyCommand: "test_analyzer" },
  primitiveRunner: successfulVerifyRunner
});
assert.equal(repairedAnalyzerRun.validation.ok, true);
const manifestAfterAnalyzerRepair = await store.readManifest("req-001");
assert.equal(manifestAfterAnalyzerRepair.manifest.stages.verify.status, "pending");
assert.equal(manifestAfterAnalyzerRepair.manifest.validation.last_result, "not_run");

const completedVerifyRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "verify",
  body: { model: "gpt-5.5", verifyCommand: "validate_generated_runtime" },
  primitiveRunner: successfulVerifyRunner
});
assert.equal(completedVerifyRun.validation.ok, true);
const manifestAfterCompletedVerify = await store.readManifest("req-001");
assert.equal(manifestAfterCompletedVerify.manifest.stages.verify.status, "complete");
assert.equal(manifestAfterCompletedVerify.manifest.validation.last_result, "passed");
const canonicalReportBeforeConflict = await readFile(
  join(repoRoot, "artifacts/af/req-001/validation-report.md"),
  "utf8"
);
const deltaBeforeConflict = await store.readArtifact("req-001", "catalog-delta.yaml");
await store.writeArtifact(
  "req-001",
  "catalog-delta.yaml",
  `${reviewedCatalogDelta}\n# concurrent edit\n`,
  deltaBeforeConflict.etag
);
await assert.rejects(
  applyStageRun({ store, reqId: "req-001", stage: "verify", runId: completedVerifyRun.run_id }),
  ArtifactConflictError
);
assert.equal(
  await readFile(join(repoRoot, "artifacts/af/req-001/validation-report.md"), "utf8"),
  canonicalReportBeforeConflict
);
const changedDelta = await store.readArtifact("req-001", "catalog-delta.yaml");
await store.writeArtifact("req-001", "catalog-delta.yaml", reviewedCatalogDelta, changedDelta.etag);
const successfulVerifyApply = await applyStageRun({
  store,
  reqId: "req-001",
  stage: "verify",
  runId: completedVerifyRun.run_id
});
assert.deepEqual(successfulVerifyApply.applied_artifacts, ["validation-report.md", "catalog-delta.yaml"]);
assert.deepEqual(successfulVerifyApply.skipped_artifacts, []);

const concurrentVerifyRun = await runStageSkill({
  repoRoot,
  store,
  reqId: "req-001",
  stage: "verify",
  body: { model: "gpt-5.5", verifyCommand: "validate_artifact_root" },
  primitiveRunner: successfulVerifyRunner
});
const concurrentVerifyDetail = await readStageRunDetail({
  store,
  reqId: "req-001",
  stage: "verify",
  runId: concurrentVerifyRun.run_id
});
const deltaBeforeBatchRace = await store.readArtifact("req-001", "catalog-delta.yaml");
const releaseConcurrentWrite = deferred();
const concurrentStore = new ArtifactRootStore({ repoRoot });
const concurrentWrite = (async () => {
  await releaseConcurrentWrite.promise;
  return await concurrentStore.writeArtifact(
    "req-001",
    "catalog-delta.yaml",
    `${reviewedCatalogDelta}\n# concurrent write after batch preflight\n`,
    deltaBeforeBatchRace.etag
  );
})();
const racingStore = new BatchRaceStore(repoRoot, async () => {
  releaseConcurrentWrite.resolve();
  await Promise.race([
    concurrentWrite.then(
      () => undefined,
      () => undefined
    ),
    new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 250))
  ]);
});
const reportBeforeBatchRace = await store.readArtifact("req-001", "validation-report.md");
const proposedReportEtag = concurrentVerifyDetail.diff_summary.files.find(
  (file) => file.path === "validation-report.md"
)?.proposed_etag;
assert.notEqual(proposedReportEtag, reportBeforeBatchRace.etag);
const concurrentBatchApply = await applyStageRun({
  store: racingStore,
  reqId: "req-001",
  stage: "verify",
  runId: concurrentVerifyRun.run_id
});
assert.deepEqual(concurrentBatchApply.applied_artifacts, ["validation-report.md", "catalog-delta.yaml"]);
await assert.rejects(() => concurrentWrite, ArtifactConflictError);
assert.equal((await store.readArtifact("req-001", "validation-report.md")).etag, proposedReportEtag);
assert.equal(
  (await store.readArtifact("req-001", "catalog-delta.yaml")).etag,
  concurrentVerifyDetail.diff_summary.files.find((file) => file.path === "catalog-delta.yaml")?.proposed_etag
);

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
await store.writeArtifact(
  "req-blocked",
  "analysis-result.json",
  `${JSON.stringify(fixtureFor("req-blocked"), null, 2)}\n`,
  null
);
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
await rm(guardedRepoRoot, { recursive: true, force: true });
