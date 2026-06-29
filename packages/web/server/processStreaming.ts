import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isRecord } from "./httpApi";

export interface ProcessResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ProcessOptions {
  readonly signal?: AbortSignal;
  readonly onStdout?: (chunk: string) => void;
  readonly onStderr?: (chunk: string) => void;
  readonly onError?: (error: Error) => void;
}

export type SseEventName = "start" | "sync" | "stdout" | "stderr" | "done" | "error";
export type ProcessPhase = "generation" | "validation";

export function runProcess(
  cwd: string,
  command: string,
  args: string[],
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    let stdout = "";
    let stderr = "";
    const cleanup = () => {
      options.signal?.removeEventListener("abort", abortChild);
    };
    const finish = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolvePromise(result);
    };
    const abortChild = () => {
      if (!settled) child.kill("SIGTERM");
    };
    if (options.signal?.aborted) {
      child.kill("SIGTERM");
    } else {
      options.signal?.addEventListener("abort", abortChild, { once: true });
    }
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      if (stdout.length > 200_000) stdout = stdout.slice(-200_000);
      options.onStdout?.(text);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
      options.onStderr?.(text);
    });
    child.on("error", (error) => {
      options.onError?.(error);
      finish({ code: -1, stdout, stderr: `${stderr}\n[spawn-error] ${error.message}` });
    });
    child.on("close", (code) => {
      finish({ code: code ?? -1, stdout, stderr });
    });
  });
}

export function flushBufferedProcessOutput(
  res: ServerResponse,
  result: ProcessResult,
  streamedStdout: boolean,
  streamedStderr: boolean,
  phase?: ProcessPhase
): void {
  const stdoutPayload = phase ? { phase, chunk: result.stdout } : { chunk: result.stdout };
  const stderrPayload = phase ? { phase, chunk: result.stderr } : { chunk: result.stderr };
  if (!streamedStdout && result.stdout) writeSseEvent(res, "stdout", stdoutPayload);
  if (!streamedStderr && result.stderr) writeSseEvent(res, "stderr", stderrPayload);
}

export function shouldStreamProcess(req: IncomingMessage, body: unknown): boolean {
  const accept = req.headers.accept;
  return (
    (isRecord(body) && body.streamProgress === true) ||
    (typeof accept === "string" && accept.includes("text/event-stream"))
  );
}

export function beginSse(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
}

export function writeSseEvent(res: ServerResponse, event: SseEventName, data: unknown): void {
  if (res.destroyed || res.writableEnded) return;
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
