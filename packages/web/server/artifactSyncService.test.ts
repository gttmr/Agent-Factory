import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncArtifactRoot } from "./artifactSync.ts";
import { ArtifactRootStore, ArtifactValidationError, type ArtifactWriteResult } from "./artifactRootStore.ts";
import { driftAnalysisResult, staleGraphVersion, staleScaffoldPlan } from "./artifactSyncFixtures.ts";
import {
  assertDriftStatus,
  assertScaffoldGraphNodes,
  fileExists,
  readJson,
  readRecord,
  writeJson
} from "./artifactSyncTestHarness.ts";

class WhitelistRecordingStore extends ArtifactRootStore {
  readonly writePaths: string[] = [];

  constructor(repoRoot: string) {
    super({ repoRoot });
  }

  override async writeArtifact(
    reqId: string,
    relative: string,
    content: string,
    ifMatch?: string | null
  ): Promise<ArtifactWriteResult> {
    this.resolveArtifactPath(reqId, relative, "write");
    this.writePaths.push(relative);
    return await super.writeArtifact(reqId, relative, content, ifMatch);
  }
}

async function assertSyncArtifactRootWritesDerivedArtifacts(root: string): Promise<void> {
  const reqId = "req-service";
  const store = new ArtifactRootStore({ repoRoot: root });
  await store.createRoot(reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  const analysis = driftAnalysisResult(reqId);
  await writeJson(join(rootDir, "analysis-result.json"), analysis);
  await writeJson(join(rootDir, "normalized-requirement.json"), analysis.normalizedRequirement);
  await writeJson(join(rootDir, "process-flow.json"), staleGraphVersion(reqId));
  await writeJson(join(rootDir, "scaffold-plan.json"), {
    ...staleScaffoldPlan(reqId, staleGraphVersion(reqId)),
    output_mode: "runnable"
  });

  const result = await syncArtifactRoot({ repoRoot: root, store, reqId });

  assert.equal(result.ok, true);
  assert.equal(result.output_mode, "runnable");
  assertDriftStatus(result.drift.before, "module-candidates.json", "missing");
  assertDriftStatus(result.drift.before, "process-flow.json", "stale");
  assertDriftStatus(result.drift.after, "module-candidates.json", "synced");
  assertDriftStatus(result.drift.after, "process-flow.json", "synced");
  assert.deepEqual(result.artifacts_written, [
    "normalized-requirement.json",
    "module-candidates.json",
    "process-flow.json",
    "scaffold-plan.json"
  ]);
  const processFlowText = await readFile(join(rootDir, "process-flow.json"), "utf8");
  assert.equal(processFlowText.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(processFlowText), analysis.processFlow);
  assertScaffoldGraphNodes(await readJson(join(rootDir, "scaffold-plan.json")), analysis.processFlow.nodes.map((node) => node.id));
  assert.equal(await fileExists(join(rootDir, "runtime-stub/agent.py")), false);
}

async function assertSyncArtifactRootWritesThroughWhitelist(root: string): Promise<void> {
  const reqId = "req-whitelist";
  const store = new WhitelistRecordingStore(root);
  await store.createRoot(reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeJson(join(rootDir, "analysis-result.json"), driftAnalysisResult(reqId));

  await syncArtifactRoot({ repoRoot: root, store, reqId, outputMode: "smoke" });

  assert.deepEqual(store.writePaths, [
    "normalized-requirement.json",
    "module-candidates.json",
    "process-flow.json",
    "scaffold-plan.json"
  ]);
  assert.deepEqual((await readdir(rootDir)).sort(), [
    "af-run-manifest.json",
    "analysis-result.json",
    "module-candidates.json",
    "normalized-requirement.json",
    "process-flow.json",
    "scaffold-plan.json"
  ]);
  assert.equal(await fileExists(join(rootDir, "runtime-stub/agent.py")), false);
}

async function assertSyncArtifactRootRejectsInvalidAnalysisWithoutWrites(root: string): Promise<void> {
  const store = new ArtifactRootStore({ repoRoot: root });
  await assertInvalidAnalysisRejected(root, store, "req-invalid", { normalizedRequirement: { id: "req-invalid" }, evidence: {}, processFlow: {} });

  const reqId = "req-invalid-malformed";
  await store.createRoot(reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeFile(join(rootDir, "analysis-result.json"), "{ malformed", "utf8");
  await assertSyncRejectsInvalidAnalysis(root, store, reqId);
  await assertNoDerivedWrites(rootDir);
}

async function assertSyncArtifactRootBindsLatestActiveCatalogRow(root: string): Promise<void> {
  const reqId = "req-catalog-latest";
  const store = new ArtifactRootStore({ repoRoot: root });
  await store.createRoot(reqId);
  await writeCatalogVersionFixture(root);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeJson(join(rootDir, "analysis-result.json"), driftAnalysisResult(reqId));

  await syncArtifactRoot({ repoRoot: root, store, reqId, outputMode: "smoke" });

  const scaffoldPlan = readRecord(await readJson(join(rootDir, "scaffold-plan.json")), "scaffold-plan");
  assert.ok(Array.isArray(scaffoldPlan.modules));
  const module = readRecord(scaffoldPlan.modules[0], "scaffold module");
  const catalogBinding = readRecord(module.catalog_binding, "catalog binding");
  assert.equal(catalogBinding.catalog_id, "seed-agent-reviewed-v2");
  assert.equal(module.scaffold_output, "latest active catalog output");
  assert.deepEqual(module.runtime_mock, { response: "latest-active" });
}

async function assertInvalidAnalysisRejected(
  root: string,
  store: ArtifactRootStore,
  reqId: string,
  analysis: unknown
): Promise<void> {
  await store.createRoot(reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeJson(join(rootDir, "analysis-result.json"), analysis);
  await assertSyncRejectsInvalidAnalysis(root, store, reqId);
  await assertNoDerivedWrites(rootDir);
}

async function assertSyncRejectsInvalidAnalysis(root: string, store: ArtifactRootStore, reqId: string): Promise<void> {
  await assert.rejects(
    syncArtifactRoot({ repoRoot: root, store, reqId, outputMode: "smoke" }),
    (error: unknown) => {
      assert.ok(error instanceof ArtifactValidationError);
      assert.equal(error.statusCode, 422);
      assert.equal(error.message, "analysis-result 검증 실패");
      return true;
    }
  );
}

async function assertNoDerivedWrites(rootDir: string): Promise<void> {
  assert.equal(await fileExists(join(rootDir, "normalized-requirement.json")), false);
  assert.equal(await fileExists(join(rootDir, "module-candidates.json")), false);
  assert.equal(await fileExists(join(rootDir, "process-flow.json")), false);
  assert.equal(await fileExists(join(rootDir, "scaffold-plan.json")), false);
}

async function writeCatalogVersionFixture(root: string): Promise<void> {
  const catalogDir = join(root, "catalog");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(join(catalogDir, "agents.yaml"), catalogVersionFixtureYaml, "utf8");
}

const catalogVersionFixtureYaml = `
agents:
  - id: seed-agent-reviewed-v1
    name: reviewed_graph_agent
    version: 1
    status: approved
    agent_kind: specialist
    component_source: stub
    scaffold_output: stale active catalog output
    responsibility: stale active row should not be selected
    runtime_mock:
      response: stale-active
  - id: seed-agent-reviewed-v3-deprecated
    name: reviewed_graph_agent
    version: 3
    status: deprecated
    agent_kind: specialist
    component_source: stub
    scaffold_output: deprecated catalog output
    responsibility: deprecated newer row should not be selected
    runtime_mock:
      response: deprecated
  - id: seed-agent-reviewed-v2
    name: reviewed_graph_agent
    version: 2
    status: approved
    agent_kind: specialist
    component_source: stub
    scaffold_output: latest active catalog output
    responsibility: latest active row should be selected
    runtime_mock:
      response: latest-active
`;

const repoRoot = await mkdtemp(join(tmpdir(), "artifact-sync-service-"));

try {
  await assertSyncArtifactRootWritesDerivedArtifacts(repoRoot);
  await assertSyncArtifactRootWritesThroughWhitelist(repoRoot);
  await assertSyncArtifactRootRejectsInvalidAnalysisWithoutWrites(repoRoot);
  await assertSyncArtifactRootBindsLatestActiveCatalogRow(repoRoot);
} finally {
  await rm(repoRoot, { recursive: true, force: true });
}
