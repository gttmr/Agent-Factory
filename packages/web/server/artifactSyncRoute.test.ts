import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { driftAnalysisResult, staleGraphVersion, staleScaffoldPlan, writeSyncReadyRoot } from "./artifactSyncFixtures.ts";
import {
  type ArtifactSyncResponse,
  type ArtifactTestRequest,
  assertDriftStatus,
  assertScaffoldGraphNodes,
  createRequester,
  createRoot,
  fileExists,
  parseJsonBody,
  parseSse,
  readCommandLog,
  readDerivedArtifactTexts,
  readJson,
  readRecord,
  responseJson,
  writeFakeScripts,
  writeJson
} from "./artifactSyncTestHarness.ts";

const approvedGates = {
  analysis_reviewed: true,
  boundaries_approved: true,
  runtime_contracts_approved: true,
  stub_ready_for_followup: false
} satisfies AfRunManifest["approvals"];

async function assertArtifactSyncRejectsUnapprovedDesignWithoutWrites(
  request: ArtifactTestRequest,
  root: string
): Promise<void> {
  const reqId = "req-sync-unapproved";
  await createRoot(request, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeJson(join(rootDir, "analysis-result.json"), driftAnalysisResult(reqId));
  const logBefore = await readCommandLog(root);

  const response = await postArtifactSync(request, reqId, {
    outputMode: "smoke",
    rebuildRuntimeStub: true,
    runValidation: true
  });

  assert.equal(response.status, 409);
  const error = parseJsonBody<{ readonly error: string }>(response).error;
  assert.match(error, /boundaries_approved/);
  assert.match(error, /runtime_contracts_approved/);
  assert.equal(await fileExists(join(rootDir, "scaffold-plan.json")), false);
  assert.equal(await fileExists(join(rootDir, "runtime-stub/agent.py")), false);
  assert.deepEqual(await readCommandLog(root), logBefore);
}

async function assertArtifactSyncRepairsStaleSplitGraph(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-drift";
  await createRoot(request, reqId);
  assert.equal((await patchApprovals(request, reqId)).status, 200);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const analysis = driftAnalysisResult(reqId);
  const staleGraph = staleGraphVersion(reqId);
  await writeJson(join(rootDir, "analysis-result.json"), analysis);
  await writeJson(join(rootDir, "normalized-requirement.json"), analysis.normalizedRequirement);
  await writeJson(join(rootDir, "asset-candidates.json"), analysis.assetCandidates);
  await writeJson(join(rootDir, "graph-ir.json"), staleGraph);
  await writeJson(join(rootDir, "scaffold-plan.json"), staleScaffoldPlan(reqId, staleGraph));
  const approvalsBefore = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` })).approvals;

  const response = await postArtifactSync(request, reqId, { outputMode: "smoke", rebuildRuntimeStub: false, runValidation: false });

  const result = responseJson<ArtifactSyncResponse>(response);
  assert.equal(result.ok, true);
  assertDriftStatus(result.drift.before, "graph-ir.json", "stale");
  assertDriftStatus(result.drift.after, "graph-ir.json", "synced");
  assert.ok(result.artifacts_written.includes("graph-ir.json"));
  assert.ok(result.artifacts_written.includes("scaffold-plan.json"));
  assert.deepEqual(await readJson(join(rootDir, "graph-ir.json")), analysis.graph);
  assertScaffoldGraphNodes(await readJson(join(rootDir, "scaffold-plan.json")), analysis.graph.nodes.map((node) => node.id));
  assert.equal((await request({ url: `/${reqId}/module-candidates.json` })).status, 404);
  assert.equal((await request({ url: `/${reqId}/process-flow.json` })).status, 404);
  const approvalsAfter = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` })).approvals;
  assert.deepEqual(approvalsAfter, approvalsBefore);
  assert.deepEqual(approvalsAfter, approvedGates);
}

async function assertArtifactSyncJsonComposesSyncGenerationAndValidation(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-json";
  await writeSyncReadyRoot(request, root, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const stubDir = join(rootDir, "runtime-stub");

  const result = responseJson<ArtifactSyncResponse>(await postArtifactSync(request, reqId, { outputMode: "smoke" }));

  assert.equal(result.ok, true);
  assert.equal(result.output_mode, "smoke");
  assertDriftStatus(result.drift.before, "graph-ir.json", "stale");
  assertDriftStatus(result.drift.after, "graph-ir.json", "synced");
  assert.equal(result.generation?.command, `node scripts/generate-adk-source.mjs ${rootDir} ${stubDir}`);
  assert.equal(result.generation?.stdout, "build stdout line\n");
  assert.equal(result.generation?.stderr, "build stderr line\n");
  assert.deepEqual(result.generation?.files, [{ path: "agent.py", bytes: 22 }]);
  assert.equal((await request({ url: `/${reqId}/implementation-handoff.md` })).text(), "# Root implementation handoff\n");
  assert.equal(result.validation?.command, `node scripts/validate-artifacts.mjs ${rootDir}`);
  assert.equal(result.validation?.command_key, "validate_artifact_root");
  assert.equal(result.validation?.stdout, "verify stdout line\n");
  assert.equal(result.validation?.stderr, "verify stderr line\n");
  const manifest = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));
  assert.equal(manifest.current_stage, "build");
  assert.deepEqual(manifest.stages.build.outputs, ["runtime-stub/agent.py"]);
  assert.equal(manifest.stages.build.status, "pending");
  assert.equal(manifest.approvals.stub_ready_for_followup, false);
}

async function assertArtifactSyncSseStreamsSyncAndProcesses(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-sse";
  await writeSyncReadyRoot(request, root, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const events = parseSse((await postArtifactSyncSse(request, reqId, { outputMode: "smoke", streamProgress: true })).text());

  assert.deepEqual(events.map((entry) => entry.event), ["start", "sync", "stdout", "stderr", "stdout", "stderr", "done"]);
  assert.equal(events[2]?.data.phase, "generation");
  assert.equal(events[2]?.data.chunk, "build stdout line\n");
  assert.equal(events[4]?.data.phase, "validation");
  assert.equal(events[4]?.data.chunk, "verify stdout line\n");
  assert.equal(events[6]?.data.ok, true);
  assert.equal(readRecord(events[6]?.data.generation, "done generation").command, `node scripts/generate-adk-source.mjs ${rootDir} ${join(rootDir, "runtime-stub")}`);
  assert.equal(readRecord(events[6]?.data.validation, "done validation").command_key, "validate_artifact_root");
}

async function assertArtifactSyncPreservesApprovalsAndSkipsValidation(request: ArtifactTestRequest): Promise<void> {
  const reqId = "req-sync-no-validation";
  await writeSyncReadyRoot(request, repoRoot, reqId);
  assert.equal((await patchApprovals(request, reqId)).status, 200);
  const manifestPath = join(repoRoot, `artifacts/af/${reqId}/af-run-manifest.json`);
  const manifest = await readJson(manifestPath) as AfRunManifest;
  await writeJson(manifestPath, {
    ...manifest,
    validation: { commands: ["previous validation command"], last_result: "failed" }
  });
  const before = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));

  const result = responseJson<ArtifactSyncResponse>(
    await postArtifactSync(request, reqId, { outputMode: "smoke", rebuildRuntimeStub: true, runValidation: false })
  );

  const after = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));
  assert.equal(result.validation, undefined);
  assert.deepEqual(after.approvals, before.approvals);
  assert.equal(after.approvals.stub_ready_for_followup, false);
  assert.deepEqual(after.validation, before.validation);
}

async function assertArtifactSyncRejectsInvalidOutputModeWithoutWrites(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-invalid-mode";
  await writeSyncReadyRoot(request, root, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const derivedBefore = await readDerivedArtifactTexts(rootDir);
  const logBefore = await readCommandLog(root);

  const response = await postArtifactSync(request, reqId, { outputMode: "bad" });

  assert.equal(response.status, 400);
  assert.match(parseJsonBody<{ readonly error: string }>(response).error, /outputMode/);
  assert.deepEqual(await readDerivedArtifactTexts(rootDir), derivedBefore);
  assert.deepEqual(await readCommandLog(root), logBefore);
}

async function assertArtifactSyncFailureOrdering(request: ArtifactTestRequest, root: string): Promise<void> {
  await assertSyncFailureStopsBeforeGeneration(request, root);
  await assertGenerationFailureStopsBeforeValidation(request, root);
  await assertValidationFailureUpdatesOnlyManifestValidation(request, root);
  await assertSseValidationFailureIncludesCommandKey(request, root);
}

async function assertSyncFailureStopsBeforeGeneration(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-bad-analysis";
  await createRoot(request, reqId);
  assert.equal((await patchApprovals(request, reqId)).status, 200);
  await writeJson(join(root, `artifacts/af/${reqId}/analysis-result.json`), {
    contract_version: "2.0",
    normalizedRequirement: { id: reqId },
    evidence: {},
    assetCandidates: [],
    graph: {}
  });
  const logBefore = await readCommandLog(root);

  const response = await postArtifactSync(request, reqId, { outputMode: "smoke", rebuildRuntimeStub: true, runValidation: true });

  assert.equal(response.status, 422);
  assert.match(parseJsonBody<{ readonly ok: boolean; readonly error: string }>(response).error, /analysis-result 검증 실패/);
  assert.deepEqual(await readCommandLog(root), logBefore);
}

async function assertGenerationFailureStopsBeforeValidation(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-generation-fails";
  await writeSyncReadyRoot(request, root, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeFile(join(rootDir, "fail-generate"), "", "utf8");
  const manifestBefore = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));

  const result = parseJsonBody<ArtifactSyncResponse>(
    await postArtifactSync(request, reqId, { outputMode: "smoke", rebuildRuntimeStub: true, runValidation: true })
  );

  assert.equal(result.ok, false);
  assert.equal(result.generation?.exit_code, 6);
  assert.equal(result.validation, undefined);
  assert.deepEqual(responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` })), manifestBefore);
  assert.equal((await readCommandLog(root)).includes(`node scripts/validate-artifacts.mjs ${rootDir}`), false);
}

async function assertValidationFailureUpdatesOnlyManifestValidation(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-validation-fails";
  await writeSyncReadyRoot(request, root, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeFile(join(rootDir, "fail-validate"), "", "utf8");
  const before = responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` }));

  const result = parseJsonBody<ArtifactSyncResponse>(
    await postArtifactSync(request, reqId, { outputMode: "smoke", rebuildRuntimeStub: false, runValidation: true })
  );

  assert.equal(result.ok, false);
  assert.equal(result.generation, undefined);
  assert.equal(result.validation?.exit_code, 7);
  assert.equal(result.validation?.command_key, "validate_artifact_root");
  assert.deepEqual(responseJson<AfRunManifest>(await request({ url: `/${reqId}/manifest` })), {
    ...before,
    validation: { commands: [`node scripts/validate-artifacts.mjs ${rootDir}`], last_result: "failed" }
  });
}

async function assertSseValidationFailureIncludesCommandKey(request: ArtifactTestRequest, root: string): Promise<void> {
  const reqId = "req-sync-sse-validation-fails";
  await writeSyncReadyRoot(request, root, reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeFile(join(rootDir, "fail-validate"), "", "utf8");

  const events = parseSse((await postArtifactSyncSse(request, reqId, { outputMode: "smoke", runValidation: true })).text());

  assert.equal(events.at(-1)?.event, "error");
  const validation = readRecord(events.at(-1)?.data.validation, "error validation");
  assert.equal(validation.exit_code, 7);
  assert.equal(validation.command, `node scripts/validate-artifacts.mjs ${rootDir}`);
  assert.equal(validation.command_key, "validate_artifact_root");
}

function patchApprovals(request: ArtifactTestRequest, reqId: string) {
  return request({ url: `/${reqId}/manifest/approvals`, method: "PATCH", headers: { "content-type": "application/json" }, body: approvedGates });
}

function postArtifactSync(request: ArtifactTestRequest, reqId: string, body: unknown) {
  return request({ url: `/${reqId}/artifact-sync/run`, method: "POST", headers: { "content-type": "application/json" }, body });
}

function postArtifactSyncSse(request: ArtifactTestRequest, reqId: string, body: unknown) {
  return request({
    url: `/${reqId}/artifact-sync/run`,
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: { rebuildRuntimeStub: true, runValidation: true, ...readRecord(body, "sync body") }
  });
}

const repoRoot = await mkdtemp(join(tmpdir(), "artifact-sync-route-"));
const originalPath = process.env.PATH ?? "";

try {
  await writeFakeScripts(repoRoot);
  process.env.PATH = `${join(repoRoot, "bin")}:${originalPath}`;
  const request = createRequester(repoRoot);
  await assertArtifactSyncRejectsUnapprovedDesignWithoutWrites(request, repoRoot);
  await assertArtifactSyncRepairsStaleSplitGraph(request, repoRoot);
  await assertArtifactSyncJsonComposesSyncGenerationAndValidation(request, repoRoot);
  await assertArtifactSyncSseStreamsSyncAndProcesses(request, repoRoot);
  await assertArtifactSyncPreservesApprovalsAndSkipsValidation(request);
  await assertArtifactSyncRejectsInvalidOutputModeWithoutWrites(request, repoRoot);
  await assertArtifactSyncFailureOrdering(request, repoRoot);
} finally {
  process.env.PATH = originalPath;
  await rm(repoRoot, { recursive: true, force: true });
}
