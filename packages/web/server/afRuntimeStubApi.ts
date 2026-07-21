import { stat, readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve, sep } from "node:path";
import type { ArtifactRootStore } from "./artifactRootStore";
import { readJsonBody, sendJson } from "./httpApi";
import { beginSse, flushBufferedProcessOutput, runProcess, shouldStreamProcess, writeSseEvent } from "./processStreaming";
import { assertBuildApprovals, recordRuntimeStubBuild } from "./runManifestBuild";
import { collectRuntimeStubFiles, isIgnoredRuntimeStubPath, type RuntimeStubFile } from "./runtimeStubFiles";

export interface RuntimeStubBuildInput {
  readonly repoRoot: string;
  readonly store: ArtifactRootStore;
  readonly reqId: string;
  readonly signal?: AbortSignal;
  readonly onStdout?: (chunk: string) => void;
  readonly onStderr?: (chunk: string) => void;
  readonly onError?: (error: Error) => void;
}

export interface RuntimeStubBuildResult {
  readonly ok: boolean;
  readonly files: readonly RuntimeStubFile[];
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;
  readonly exit_code?: number | null;
}

export async function handleListRuntimeStub(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const exists = await stat(stubDir).then((s) => s.isDirectory()).catch(() => false);
  if (!exists) {
    sendJson(res, 200, { exists: false, files: [] });
    return;
  }
  const files = await collectRuntimeStubFiles(stubDir, stubDir);
  sendJson(res, 200, { exists: true, files });
}

export async function handleReadRuntimeStubFile(
  store: ArtifactRootStore,
  reqId: string,
  relativeFile: string,
  res: ServerResponse
): Promise<void> {
  if (relativeFile.includes("..") || relativeFile.startsWith("/")) {
    sendJson(res, 403, { error: "허용되지 않은 경로입니다." });
    return;
  }
  if (isIgnoredRuntimeStubPath(relativeFile)) {
    sendJson(res, 403, { error: "runtime-stub 로컬 실행 산출물은 미리보기 대상이 아닙니다." });
    return;
  }
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const target = resolve(stubDir, relativeFile);
  if (!target.startsWith(stubDir + sep) && target !== stubDir) {
    sendJson(res, 403, { error: "허용되지 않은 경로입니다." });
    return;
  }
  const fileStat = await stat(target).catch(() => null);
  if (!fileStat?.isFile()) {
    sendJson(res, 404, { error: `파일을 찾을 수 없습니다: ${relativeFile}` });
    return;
  }
  if (fileStat.size > 500_000) {
    sendJson(res, 413, { error: "파일이 500KB 를 초과합니다." });
    return;
  }
  const content = await readFile(target, "utf8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(content);
}

export async function handleBuildRuntimeStub(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req).catch(() => ({}));
  await assertBuildApprovals(store, reqId);
  const rootDir = store.resolveRootDir(reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const args = ["scripts/generate-adk-source.mjs", rootDir, stubDir];
  const command = `node ${args.join(" ")}`;
  if (shouldStreamProcess(req, body)) {
    await handleBuildRuntimeStubSse(repoRoot, store, reqId, command, res);
    return;
  }
  const result = await runRuntimeStubBuild({ repoRoot, store, reqId });
  if (!result.ok) {
    sendJson(res, 422, {
      error: "runtime-stub 생성 실패",
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      command
    });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    files: result.files,
    stdout: result.stdout,
    stderr: result.stderr,
    command
  });
}

export async function runRuntimeStubBuild(input: RuntimeStubBuildInput): Promise<RuntimeStubBuildResult> {
  await assertBuildApprovals(input.store, input.reqId);
  const rootDir = input.store.resolveRootDir(input.reqId);
  const stubDir = join(rootDir, "runtime-stub");
  const args = ["scripts/generate-adk-source.mjs", rootDir, stubDir];
  const command = `node ${args.join(" ")}`;
  const result = await runProcess(input.repoRoot, "node", args, {
    signal: input.signal,
    onStdout: input.onStdout,
    onStderr: input.onStderr,
    onError: input.onError
  });
  if (result.code !== 0) {
    return {
      ok: false,
      files: [],
      stdout: result.stdout,
      stderr: result.stderr,
      command,
      exit_code: result.code
    };
  }
  const files = await collectRuntimeStubFiles(stubDir, stubDir);
  await recordRuntimeStubBuild(input.store, input.reqId, files);
  return {
    ok: true,
    files,
    stdout: result.stdout,
    stderr: result.stderr,
    command,
    exit_code: result.code
  };
}

async function handleBuildRuntimeStubSse(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  command: string,
  res: ServerResponse
): Promise<void> {
  beginSse(res);
  const abortController = new AbortController();
  const abortOnClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on("close", abortOnClose);
  writeSseEvent(res, "start", { command, started_at: new Date().toISOString() });
  try {
    let streamedStdout = false;
    let streamedStderr = false;
    const result = await runRuntimeStubBuild({
      repoRoot,
      store,
      reqId,
      signal: abortController.signal,
      onStdout: (chunk) => {
        streamedStdout = true;
        writeSseEvent(res, "stdout", { chunk });
      },
      onStderr: (chunk) => {
        streamedStderr = true;
        writeSseEvent(res, "stderr", { chunk });
      },
      onError: (error) => writeSseEvent(res, "error", { error: error.message })
    });
    flushBufferedProcessOutput(
      res,
      { code: result.exit_code ?? (result.ok ? 0 : -1), stdout: result.stdout, stderr: result.stderr },
      streamedStdout,
      streamedStderr
    );
    if (!result.ok) {
      writeSseEvent(res, "error", {
        error: "runtime-stub 생성 실패",
        exit_code: result.exit_code,
        stdout: result.stdout,
        stderr: result.stderr,
        command
      });
      return;
    }
    writeSseEvent(res, "done", {
      ok: true,
      files: result.files,
      stdout: result.stdout,
      stderr: result.stderr,
      command
    });
  } catch (error) {
    writeSseEvent(res, "error", {
      error: error instanceof Error ? error.message : "runtime-stub 생성 실패",
      command
    });
  } finally {
    res.off("close", abortOnClose);
    res.end();
  }
}
