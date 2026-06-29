import type { ServerResponse } from "node:http";
import { join } from "node:path";
import type { ArtifactRootStore } from "./artifactRootStore";
import { writeManifestValidationResult } from "./manifestValidation";
import { flushBufferedProcessOutput, runProcess, writeSseEvent } from "./processStreaming";
import { collectRuntimeStubFiles, type RuntimeStubFile } from "./runtimeStubFiles";

export interface ArtifactSyncProcessSummary {
  readonly ok: boolean;
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;
  readonly files?: readonly RuntimeStubFile[];
}

export type ArtifactSyncValidationSummary = ArtifactSyncProcessSummary & {
  readonly command_key: "validate_artifact_root";
};

export function buildGenerationCommand(
  store: ArtifactRootStore,
  reqId: string
): { readonly args: readonly string[]; readonly command: string; readonly stubDir: string } {
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const args = ["scripts/generate-adk-source.mjs", rootDir, stubDir];
  return { args, command: `node ${args.join(" ")}`, stubDir };
}

export function buildValidationCommand(
  store: ArtifactRootStore,
  reqId: string
): { readonly argv: readonly string[]; readonly command: string } {
  const rootDir = store.resolveRootDir(reqId);
  const argv = ["node", "scripts/validate-artifacts.mjs", rootDir];
  return { argv, command: argv.join(" ") };
}

export async function runGenerationStep(
  repoRoot: string,
  command: { readonly args: readonly string[]; readonly command: string; readonly stubDir: string },
  signal?: AbortSignal,
  res?: ServerResponse
): Promise<ArtifactSyncProcessSummary> {
  let streamedStdout = false;
  let streamedStderr = false;
  const result = await runProcess(repoRoot, "node", [...command.args], {
    signal,
    onStdout: (chunk) => {
      streamedStdout = true;
      if (res) writeSseEvent(res, "stdout", { phase: "generation", chunk });
    },
    onStderr: (chunk) => {
      streamedStderr = true;
      if (res) writeSseEvent(res, "stderr", { phase: "generation", chunk });
    },
    onError: (error) => {
      if (res) writeSseEvent(res, "error", { error: error.message });
    }
  });
  if (res) flushBufferedProcessOutput(res, result, streamedStdout, streamedStderr, "generation");
  const ok = result.code === 0;
  return {
    ok,
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    command: command.command,
    ...(ok ? { files: await collectRuntimeStubFiles(command.stubDir, command.stubDir) } : {})
  };
}

export async function runValidationStep(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  command: { readonly argv: readonly string[]; readonly command: string },
  signal?: AbortSignal,
  res?: ServerResponse
): Promise<ArtifactSyncValidationSummary> {
  let streamedStdout = false;
  let streamedStderr = false;
  const [executable, ...args] = command.argv;
  const result = await runProcess(repoRoot, executable, args, {
    signal,
    onStdout: (chunk) => {
      streamedStdout = true;
      if (res) writeSseEvent(res, "stdout", { phase: "validation", chunk });
    },
    onStderr: (chunk) => {
      streamedStderr = true;
      if (res) writeSseEvent(res, "stderr", { phase: "validation", chunk });
    },
    onError: (error) => {
      if (res) writeSseEvent(res, "error", { error: error.message });
    }
  });
  if (res) flushBufferedProcessOutput(res, result, streamedStdout, streamedStderr, "validation");
  const ok = result.code === 0;
  await writeManifestValidationResult(store, reqId, command.command, ok);
  return {
    ok,
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    command: command.command,
    command_key: "validate_artifact_root"
  };
}
