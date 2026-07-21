import { join } from "node:path";
import type { ArtifactRootStore } from "./artifactRootStore";
import { ArtifactValidationError } from "./artifactRootStore";
import { assertBuildApprovals } from "./runManifestBuild";
import { collectRuntimeStubFiles } from "./runtimeStubFiles";

export async function assertVerifyReady(store: ArtifactRootStore, reqId: string): Promise<void> {
  await assertBuildApprovals(store, reqId);
  const { manifest } = await store.readManifest(reqId);
  if (!manifest.approvals.stub_ready_for_followup || manifest.stages.build.status !== "complete") {
    throw new ArtifactValidationError(
      409,
      "Verify 실행 전 Build handoff 승인이 필요합니다: stub_ready_for_followup=true"
    );
  }
  const stubDir = join(store.resolveRootDir(reqId), "runtime-stub");
  const files = await collectRuntimeStubFiles(stubDir, stubDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  if (files.length === 0) {
    throw new ArtifactValidationError(409, "Verify 실행 전 생성된 runtime-stub 파일이 필요합니다.");
  }
}
