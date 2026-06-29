import type { IncomingMessage, ServerResponse } from "node:http";
import type { ArtifactRootStore } from "./artifactRootStore";
import { isRecord, readJsonBody, sendJson } from "./httpApi";
import { writeManifestValidationResult } from "./manifestValidation";
import { beginSse, flushBufferedProcessOutput, runProcess, shouldStreamProcess, writeSseEvent } from "./processStreaming";

const VERIFY_COMMANDS: Record<string, { readonly argv: readonly string[]; readonly description: string }> = {
  validate_artifact_root: {
    argv: ["node", "scripts/validate-artifacts.mjs"],
    description: "validate-artifacts.mjs against the artifact root"
  },
  build_web: {
    argv: ["npm", "run", "build", "--prefix", "packages/web"],
    description: "tsc --noEmit && vite build"
  },
  test_analyzer: {
    argv: ["npm", "run", "test:analyzer", "--prefix", "packages/web"],
    description: "analyzer unit tests"
  }
};

export function handleVerifyCommands(res: ServerResponse): void {
  sendJson(
    res,
    200,
    Object.entries(VERIFY_COMMANDS).map(([key, value]) => ({
      key,
      argv: value.argv,
      description: value.description
    }))
  );
}

export async function handleVerifyRun(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    sendJson(res, 400, { error: "본문은 객체여야 합니다." });
    return;
  }
  const key = typeof body.command === "string" ? body.command : "";
  const command = VERIFY_COMMANDS[key];
  if (!command) {
    sendJson(res, 400, { error: `허용되지 않은 명령입니다: ${key}` });
    return;
  }
  const rootDir = store.resolveRootDir(reqId);
  const argv =
    key === "validate_artifact_root" ? [...command.argv, rootDir] : [...command.argv];
  if (shouldStreamProcess(req, body)) {
    await handleVerifyRunSse(repoRoot, store, reqId, key, argv, res);
    return;
  }
  const result = await runProcess(repoRoot, argv[0], argv.slice(1));
  const passed = result.code === 0;

  await writeManifestValidationResult(store, reqId, argv.join(" "), passed);

  sendJson(res, passed ? 200 : 422, {
    ok: passed,
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    command: argv.join(" "),
    command_key: key
  });
}

async function handleVerifyRunSse(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  key: string,
  argv: string[],
  res: ServerResponse
): Promise<void> {
  beginSse(res);
  const command = argv.join(" ");
  const abortController = new AbortController();
  const abortOnClose = () => {
    if (!res.writableEnded) abortController.abort();
  };
  res.on("close", abortOnClose);
  writeSseEvent(res, "start", { command, command_key: key, started_at: new Date().toISOString() });
  try {
    let streamedStdout = false;
    let streamedStderr = false;
    const result = await runProcess(repoRoot, argv[0], argv.slice(1), {
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
    flushBufferedProcessOutput(res, result, streamedStdout, streamedStderr);
    const passed = result.code === 0;

    await writeManifestValidationResult(store, reqId, command, passed);

    const payload = {
      ok: passed,
      exit_code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      command,
      command_key: key
    };
    writeSseEvent(res, passed ? "done" : "error", passed ? payload : { ...payload, error: "verify 실행 실패" });
  } catch (error) {
    writeSseEvent(res, "error", {
      error: error instanceof Error ? error.message : "verify 실행 실패",
      command,
      command_key: key
    });
  } finally {
    res.off("close", abortOnClose);
    res.end();
  }
}
