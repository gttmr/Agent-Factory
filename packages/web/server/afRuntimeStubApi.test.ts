import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtifactRootStore } from "./artifactRootStore.ts";
import { runRuntimeStubBuild } from "./afRuntimeStubApi.ts";
import { writeFakeScripts } from "./artifactSyncTestHarness.ts";

const repoRoot = await mkdtemp(join(tmpdir(), "af-runtime-stub-api-"));
const originalPath = process.env.PATH ?? "";

try {
  await writeFakeScripts(repoRoot);
  process.env.PATH = `${join(repoRoot, "bin")}:${originalPath}`;
  const store = new ArtifactRootStore({ repoRoot });

  await store.createRoot("req-build-success");
  const successManifestPath = join(repoRoot, "artifacts/af/req-build-success/af-run-manifest.json");
  const successManifest = JSON.parse(await readFile(successManifestPath, "utf8"));
  successManifest.stages.analyze.review_metadata = { owner: "analysis-reviewer" };
  successManifest.stages.build.review_metadata = { owner: "build-reviewer" };
  await writeFile(successManifestPath, `${JSON.stringify(successManifest, null, 2)}\n`, "utf8");
  const approvalsBefore = successManifest.approvals;

  const success = await runRuntimeStubBuild({ repoRoot, store, reqId: "req-build-success" });

  assert.equal(success.ok, true);
  const manifestAfterSuccess = JSON.parse(await readFile(successManifestPath, "utf8"));
  assert.equal(manifestAfterSuccess.current_stage, "build");
  assert.deepEqual(manifestAfterSuccess.stages.build.outputs, ["runtime-stub/agent.py"]);
  assert.equal(manifestAfterSuccess.stages.build.status, "pending");
  assert.deepEqual(manifestAfterSuccess.approvals, approvalsBefore);
  assert.deepEqual(manifestAfterSuccess.stages.analyze.review_metadata, { owner: "analysis-reviewer" });
  assert.deepEqual(manifestAfterSuccess.stages.build.review_metadata, { owner: "build-reviewer" });

  await store.createRoot("req-build-failure");
  const failureRoot = join(repoRoot, "artifacts/af/req-build-failure");
  const failureManifestPath = join(failureRoot, "af-run-manifest.json");
  await writeFile(join(failureRoot, "fail-generate"), "", "utf8");
  const failureManifestBefore = await readFile(failureManifestPath);

  const failure = await runRuntimeStubBuild({ repoRoot, store, reqId: "req-build-failure" });

  assert.equal(failure.ok, false);
  assert.deepEqual(await readFile(failureManifestPath), failureManifestBefore);
} finally {
  process.env.PATH = originalPath;
  await rm(repoRoot, { recursive: true, force: true });
}
