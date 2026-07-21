import type { IncomingMessage, ServerResponse } from "node:http";
import type { ArtifactRootStore } from "./artifactRootStore";
import { isRecord, readJsonBody, sendJson } from "./httpApi";
import { writeVerifyManifestResult } from "./manifestValidation";
import { beginSse, flushBufferedProcessOutput, runProcess, shouldStreamProcess, writeSseEvent } from "./processStreaming";
import { assertVerifyReady } from "./verifyReadiness";

export const VERIFY_COMMANDS = {
  validate_artifact_root: {
    argv: ["node", "scripts/validate-artifacts.mjs"],
    description: "validate-artifacts.mjs against the artifact root"
  },
  validate_generated_runtime: {
    argv: ["node", "scripts/validate-generated-runtime.mjs"],
    description: "compile and run generated runtime contract/import tests"
  },
  build_web: {
    argv: ["npm", "run", "build", "--prefix", "packages/web"],
    description: "tsc --noEmit && vite build"
  },
  test_analyzer: {
    argv: ["npm", "run", "test:analyzer", "--prefix", "packages/web"],
    description: "analyzer unit tests"
  }
} as const satisfies Record<string, { readonly argv: readonly string[]; readonly description: string }>;

export type VerifyCommandKey = keyof typeof VERIFY_COMMANDS;

export interface VerifyCommandInput {
  readonly repoRoot: string;
  readonly store: ArtifactRootStore;
  readonly reqId: string;
  readonly commandKey: string;
  readonly signal?: AbortSignal;
  readonly onStdout?: (chunk: string) => void;
  readonly onStderr?: (chunk: string) => void;
  readonly onError?: (error: Error) => void;
  readonly recordManifest?: boolean;
}

export interface VerifyCommandResult {
  readonly ok: boolean;
  readonly exit_code: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly command: string;
  readonly command_key: VerifyCommandKey;
}

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
  const commandKey = normalizeVerifyCommandKey(key);
  if (!commandKey) {
    sendJson(res, 400, { error: `허용되지 않은 명령입니다: ${key}` });
    return;
  }
  await assertVerifyReady(store, reqId);
  const argv = verifyCommandArgv(store, reqId, commandKey);
  if (shouldStreamProcess(req, body)) {
    await handleVerifyRunSse(repoRoot, store, reqId, commandKey, argv, res);
    return;
  }
  const result = await runVerifyCommand({ repoRoot, store, reqId, commandKey });

  sendJson(res, result.ok ? 200 : 422, {
    ok: result.ok,
    exit_code: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    command: result.command,
    command_key: result.command_key
  });
}

export function normalizeVerifyCommandKey(value: string | undefined | null): VerifyCommandKey | null {
  return typeof value === "string" && value in VERIFY_COMMANDS ? (value as VerifyCommandKey) : null;
}

export function verifyCommandArgv(store: ArtifactRootStore, reqId: string, commandKey: VerifyCommandKey): string[] {
  const command = VERIFY_COMMANDS[commandKey];
  return commandKey === "validate_artifact_root" || commandKey === "validate_generated_runtime"
    ? [...command.argv, store.resolveRootDir(reqId)]
    : [...command.argv];
}

export async function runVerifyCommand(input: VerifyCommandInput): Promise<VerifyCommandResult> {
  const commandKey = normalizeVerifyCommandKey(input.commandKey);
  if (!commandKey) {
    throw new Error(`허용되지 않은 명령입니다: ${input.commandKey}`);
  }
  await assertVerifyReady(input.store, input.reqId);
  const argv = verifyCommandArgv(input.store, input.reqId, commandKey);
  const command = argv.join(" ");
  const result = await runProcess(input.repoRoot, argv[0], argv.slice(1), {
    signal: input.signal,
    onStdout: input.onStdout,
    onStderr: input.onStderr,
    onError: input.onError
  });
  const passed = result.code === 0;
  if (input.recordManifest !== false) {
    await writeVerifyManifestResult(input.store, input.reqId, commandKey, command, passed);
  }
  return {
    ok: passed,
    exit_code: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    command,
    command_key: commandKey
  };
}

async function handleVerifyRunSse(
  repoRoot: string,
  store: ArtifactRootStore,
  reqId: string,
  key: VerifyCommandKey,
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
    const result = await runVerifyCommand({
      repoRoot,
      store,
      reqId,
      commandKey: key,
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
      { code: result.exit_code, stdout: result.stdout, stderr: result.stderr },
      streamedStdout,
      streamedStderr
    );

    const payload = {
      ok: result.ok,
      exit_code: result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      command,
      command_key: key
    };
    writeSseEvent(res, result.ok ? "done" : "error", result.ok ? payload : { ...payload, error: "verify 실행 실패" });
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
