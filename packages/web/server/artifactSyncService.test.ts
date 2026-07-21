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
  await writeJson(join(rootDir, "graph-ir.json"), staleGraphVersion(reqId));
  await writeJson(join(rootDir, "scaffold-plan.json"), {
    ...staleScaffoldPlan(reqId, staleGraphVersion(reqId)),
    output_mode: "runnable"
  });

  const result = await syncArtifactRoot({ repoRoot: root, store, reqId, catalogEntries: [] });

  assert.equal(result.ok, true);
  assert.equal(result.output_mode, "runnable");
  assertDriftStatus(result.drift.before, "asset-candidates.json", "missing");
  assertDriftStatus(result.drift.before, "graph-ir.json", "stale");
  assertDriftStatus(result.drift.after, "asset-candidates.json", "synced");
  assertDriftStatus(result.drift.after, "graph-ir.json", "synced");
  assert.deepEqual(result.artifacts_written, [
    "normalized-requirement.json",
    "asset-candidates.json",
    "graph-ir.json",
    "scaffold-plan.json"
  ]);
  const graphText = await readFile(join(rootDir, "graph-ir.json"), "utf8");
  assert.equal(graphText.endsWith("\n"), true);
  assert.deepEqual(JSON.parse(graphText), analysis.graph);
  assert.deepEqual(await readJson(join(rootDir, "asset-candidates.json")), analysis.assetCandidates);
  const scaffoldPlan = readRecord(await readJson(join(rootDir, "scaffold-plan.json")), "scaffold-plan");
  assert.equal(scaffoldPlan.contract_version, "2.0");
  assert.equal(scaffoldPlan.raw_requirement_to_code, false);
  assert.equal("modules" in scaffoldPlan, false);
  assert.equal("excluded_modules" in scaffoldPlan, false);
  assertScaffoldGraphNodes(scaffoldPlan, analysis.graph.nodes.map((node) => node.id));
  assert.equal(await fileExists(join(rootDir, "module-candidates.json")), false);
  assert.equal(await fileExists(join(rootDir, "process-flow.json")), false);
  assert.equal(await fileExists(join(rootDir, "runtime-stub/agent.py")), false);
}

async function assertSyncArtifactRootWritesThroughWhitelist(root: string): Promise<void> {
  const reqId = "req-whitelist";
  const store = new WhitelistRecordingStore(root);
  await store.createRoot(reqId);
  const rootDir = join(root, `artifacts/af/${reqId}`);
  await writeJson(join(rootDir, "analysis-result.json"), driftAnalysisResult(reqId));

  await syncArtifactRoot({ repoRoot: root, store, reqId, outputMode: "smoke", catalogEntries: [] });

  assert.deepEqual(store.writePaths, [
    "normalized-requirement.json",
    "asset-candidates.json",
    "graph-ir.json",
    "scaffold-plan.json"
  ]);
  assert.deepEqual((await readdir(rootDir)).sort(), [
    "af-run-manifest.json",
    "analysis-result.json",
    "asset-candidates.json",
    "graph-ir.json",
    "normalized-requirement.json",
    "scaffold-plan.json"
  ]);
  assert.equal(await fileExists(join(rootDir, "runtime-stub/agent.py")), false);
}

async function assertSyncArtifactRootRejectsInvalidAnalysisWithoutWrites(root: string): Promise<void> {
  const store = new ArtifactRootStore({ repoRoot: root });
  await assertInvalidAnalysisRejected(root, store, "req-invalid", {
    contract_version: "2.0",
    normalizedRequirement: { id: "req-invalid" },
    evidence: {},
    assetCandidates: [],
    graph: {}
  });
  await assertInvalidAnalysisRejected(root, store, "req-legacy-shape", {
    contract_version: "2.0",
    normalizedRequirement: { id: "req-legacy-shape" },
    evidence: {},
    moduleCandidates: [],
    processFlow: {}
  });
  const versionless = structuredClone(driftAnalysisResult("req-versionless")) as Partial<ReturnType<typeof driftAnalysisResult>>;
  delete versionless.contract_version;
  await assertInvalidAnalysisRejected(root, store, "req-versionless", versionless);

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
  await writeJson(join(rootDir, "analysis-result.json"), driftAnalysisResult(reqId, "agent.reviewed-graph"));

  await syncArtifactRoot({ repoRoot: root, store, reqId, outputMode: "smoke" });

  const scaffoldPlan = readRecord(await readJson(join(rootDir, "scaffold-plan.json")), "scaffold-plan");
  assert.ok(Array.isArray(scaffoldPlan.assets));
  const manifest = readRecord(scaffoldPlan.manifest, "scaffold manifest");
  assert.ok(Array.isArray(manifest.catalog_bound_assets));
  const catalogBinding = readRecord(
    manifest.catalog_bound_assets.find((entry) => readRecord(entry, "catalog binding").asset_id === "agent.reviewed-graph"),
    "catalog binding"
  );
  assert.equal(catalogBinding.catalog_id, "agent.reviewed-graph");
  assert.equal(catalogBinding.catalog_name, "reviewed_graph_agent_latest");
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
  assert.equal(await fileExists(join(rootDir, "asset-candidates.json")), false);
  assert.equal(await fileExists(join(rootDir, "graph-ir.json")), false);
  assert.equal(await fileExists(join(rootDir, "scaffold-plan.json")), false);
}

async function writeCatalogVersionFixture(root: string): Promise<void> {
  const catalogDir = join(root, "catalog");
  await mkdir(catalogDir, { recursive: true });
  await writeFile(join(catalogDir, "agents.yaml"), catalogVersionFixtureYaml, "utf8");
  await writeFile(join(catalogDir, "workflows.yaml"), "workflows: []\n", "utf8");
  await writeFile(join(catalogDir, "tools.yaml"), "tools: []\n", "utf8");
}

const catalogVersionFixtureYaml = `
agents:
  - asset_id: agent.reviewed-graph
    asset_type: agent
    name: reviewed_graph_agent_stale
    version: 1
    status: approved
    domain_scope: domain_neutral
    business_domains: []
    owner: platform
    reuse_status: reuse_existing
    capability_tags: [artifact-sync]
    binding: null
    connection: null
    workflow_profile: null
    exposure: null
    responsibility: stale active row should not be selected
  - asset_id: agent.reviewed-graph
    asset_type: agent
    name: reviewed_graph_agent_deprecated
    version: 3
    status: deprecated
    domain_scope: domain_neutral
    business_domains: []
    owner: platform
    reuse_status: reuse_existing
    capability_tags: [artifact-sync]
    binding: null
    connection: null
    workflow_profile: null
    exposure: null
    responsibility: deprecated newer row should not be selected
  - asset_id: agent.reviewed-graph
    asset_type: agent
    name: reviewed_graph_agent_latest
    version: 2
    status: approved
    domain_scope: domain_neutral
    business_domains: []
    owner: platform
    reuse_status: reuse_existing
    capability_tags: [artifact-sync]
    binding: null
    connection: null
    workflow_profile: null
    exposure: null
    responsibility: latest active row should be selected
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
