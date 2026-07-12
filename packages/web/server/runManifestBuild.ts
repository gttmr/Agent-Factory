import type { AfRunManifest } from "../src/analyzer/afRunManifest";
import type { ArtifactRootStore } from "./artifactRootStore";
import type { RuntimeStubFile } from "./runtimeStubFiles";

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
