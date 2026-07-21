import type { AfRunManifest } from "../src/analyzer/afRunManifest";
import { ArtifactValidationError, type ArtifactRootStore } from "./artifactRootStore";
import type { RuntimeStubFile } from "./runtimeStubFiles";

const REQUIRED_BUILD_APPROVALS = ["analysis_reviewed", "boundaries_approved", "runtime_contracts_approved"] as const;

export async function assertBuildApprovals(store: ArtifactRootStore, reqId: string): Promise<void> {
  const { manifest } = await store.readManifest(reqId);
  const missing = REQUIRED_BUILD_APPROVALS.filter((approval) => manifest.approvals[approval] !== true);
  if (missing.length > 0) {
    throw new ArtifactValidationError(
      409,
      `Build 실행 전 Analyze/Compose 승인이 필요합니다: ${missing.join(", ")}`
    );
  }
}

export function updateRunManifest(
  manifest: AfRunManifest,
  generatedFiles: readonly RuntimeStubFile[]
): AfRunManifest {
  return {
    ...manifest,
    current_stage: "build",
    stages: {
      ...manifest.stages,
      build: {
        ...manifest.stages.build,
        outputs: uniqueStrings(generatedFiles.map((file) => `runtime-stub/${file.path}`))
      }
    }
  };
}

export async function recordRuntimeStubBuild(
  store: ArtifactRootStore,
  reqId: string,
  generatedFiles: readonly RuntimeStubFile[]
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  await store.writeManifest(reqId, updateRunManifest(manifest, generatedFiles), etag);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))];
}
