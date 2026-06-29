import type { AfRunManifest } from "../src/analyzer/afRunManifest";
import type { ArtifactRootStore } from "./artifactRootStore";

export async function writeManifestValidationResult(
  store: ArtifactRootStore,
  reqId: string,
  command: string,
  passed: boolean
): Promise<void> {
  const { manifest } = await store.readManifest(reqId);
  const next: AfRunManifest = {
    ...manifest,
    validation: {
      commands: [command],
      last_result: passed ? "passed" : "failed"
    }
  };
  await store.writeManifest(reqId, next, null);
}
