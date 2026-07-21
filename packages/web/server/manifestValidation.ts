import type { AfRunManifest } from "../src/analyzer/afRunManifest";
import type { ArtifactRootStore } from "./artifactRootStore";

export const REQUIRED_VERIFY_COMMAND_KEYS = ["validate_artifact_root", "validate_generated_runtime"] as const;

export async function writeManifestValidationResult(
  store: ArtifactRootStore,
  reqId: string,
  command: string,
  passed: boolean
): Promise<void> {
  await store.withCanonicalWriteLock(reqId, async () => {
    const { manifest } = await store.readManifest(reqId);
    const next: AfRunManifest = {
      ...manifest,
      validation: {
        commands: [command],
        last_result: passed ? "passed" : "failed"
      }
    };
    await store.writeManifest(reqId, next, null);
  });
}

export async function writeVerifyManifestResult(
  store: ArtifactRootStore,
  reqId: string,
  commandKey: string,
  command: string,
  passed: boolean
): Promise<void> {
  await store.withCanonicalWriteLock(reqId, async () => {
    const { manifest } = await store.readManifest(reqId);
    const prefix = `[${commandKey}] `;
    const commands = [
      ...manifest.validation.commands.filter((entry) => !entry.startsWith(prefix)),
      `${prefix}${passed ? "passed" : "failed"}: ${command}`
    ];
    const evidence = new Map<string, "passed" | "failed">();
    for (const entry of commands) {
      const match = /^\[([^\]]+)] (passed|failed): /.exec(entry);
      if (match?.[1] && match[2]) evidence.set(match[1], match[2] as "passed" | "failed");
    }
    const hasFailure = [...evidence.values()].includes("failed");
    const allRequiredPassed = REQUIRED_VERIFY_COMMAND_KEYS.every((key) => evidence.get(key) === "passed");
    const aggregateResult = hasFailure ? "failed" : allRequiredPassed ? "passed" : "not_run";
    const next: AfRunManifest = {
      ...manifest,
      current_stage: "verify",
      stages: {
        ...manifest.stages,
        verify: {
          ...manifest.stages.verify,
          status: aggregateResult === "passed" ? "complete" : aggregateResult === "failed" ? "blocked" : "pending"
        }
      },
      validation: {
        commands,
        last_result: aggregateResult
      }
    };
    await store.writeManifest(reqId, next, null);
  });
}
