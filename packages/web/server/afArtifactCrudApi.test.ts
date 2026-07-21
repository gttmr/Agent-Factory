import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AfRunManifest } from "../src/analyzer/afRunManifest.ts";
import { projectApprovalStageStatuses } from "./afArtifactCrudApi.ts";
import { ArtifactRootStore, ArtifactValidationError } from "./artifactRootStore.ts";

const completeManifest = {
  requirement_id: "req-approval-status",
  artifact_root: "artifacts/af/req-approval-status",
  current_stage: "build",
  stages: {
    analyze: { status: "complete", outputs: ["analysis-result.json"] },
    design: { status: "complete", outputs: ["scaffold-plan.json"] },
    build: { status: "complete", outputs: ["runtime-stub/implementation-handoff.md"] },
    verify: { status: "blocked", outputs: ["validation-report.md"] }
  },
  approvals: {
    analysis_reviewed: true,
    boundaries_approved: true,
    runtime_contracts_approved: true,
    stub_ready_for_followup: true
  },
  validation: { commands: [], last_result: "not_run" }
} satisfies AfRunManifest;

const projected = projectApprovalStageStatuses(completeManifest, {
  analysis_reviewed: false,
  boundaries_approved: true,
  runtime_contracts_approved: false,
  stub_ready_for_followup: false
});

assert.equal(projected.analyze.status, "pending");
assert.equal(projected.design.status, "pending");
assert.equal(projected.build.status, "pending");
assert.equal(projected.verify.status, "blocked");
assert.deepEqual(projected.analyze.outputs, completeManifest.stages.analyze.outputs);
assert.deepEqual(projected.design.outputs, completeManifest.stages.design.outputs);
assert.deepEqual(projected.build.outputs, completeManifest.stages.build.outputs);

const repoRoot = await mkdtemp(join(tmpdir(), "af-artifact-paths-"));
const store = new ArtifactRootStore({ repoRoot });
await store.createRoot("req-target-paths");
await store.writeArtifact("req-target-paths", "asset-candidates.json", "[]\n", null);
await store.writeArtifact("req-target-paths", "graph-ir.json", "{}\n", null);
assert.equal((await store.readArtifact("req-target-paths", "asset-candidates.json")).content, "[]\n");
assert.equal((await store.readArtifact("req-target-paths", "graph-ir.json")).content, "{}\n");
await writeFile(join(repoRoot, "artifacts/af/req-target-paths/a2a-contracts.json"), "[]\n", "utf8");
for (const mode of ["read", "write"] as const) {
  await assert.rejects(
    mode === "read"
      ? store.readArtifact("req-target-paths", "a2a-contracts.json")
      : store.writeArtifact("req-target-paths", "a2a-contracts.json", "[]\n", null),
    (error: unknown) =>
      error instanceof ArtifactValidationError &&
      error.statusCode === 405 &&
      error.message.includes("a2a-contracts.json")
  );
}
for (const legacyPath of ["module-candidates.json", "process-flow.json", "commonization-notes.json"]) {
  await assert.rejects(
    store.writeArtifact("req-target-paths", legacyPath, "{}\n", null),
    (error: unknown) =>
      error instanceof ArtifactValidationError &&
      error.statusCode === 405 &&
      error.message.includes(legacyPath)
  );
}
await rm(repoRoot, { recursive: true, force: true });
