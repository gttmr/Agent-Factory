import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { collectRuntimeStubFiles } from "./runtimeStubFiles";
import type { RuntimeA2aMessageSendResume } from "./runtimeA2aTypes";

const execFileAsync = promisify(execFile);

export interface RuntimeProcessRecord {
  pid: number;
  port: number;
  host: string;
  appName: string;
  command: string;
  startedAt: string;
  stubFingerprint?: string;
  lastMessageSendProbe?: RuntimeProcessMessageSendProbe;
}

export interface RuntimeProcessMessageSendProbe {
  status: "not_checked" | "ready" | "working" | "interactive_required" | "failed";
  taskState: string | null;
  message: string | null;
  taskId?: string | null;
  contextId?: string | null;
  resume?: RuntimeA2aMessageSendResume | null;
  checkedAt: string;
}

export interface RuntimeRecordContext {
  stubDir: string;
  port: number;
  host: string;
}

export async function writeProcessRecord(
  ctx: RuntimeRecordContext,
  registryPath: string,
  record: RuntimeProcessRecord
): Promise<void> {
  if (!Number.isInteger(record.pid) || record.pid <= 0) return;
  await mkdir(join(ctx.stubDir, ".adk"), { recursive: true });
  await writeFile(processRecordPath(ctx, registryPath), `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

export async function readProcessRecord(
  ctx: RuntimeRecordContext,
  registryPath: string
): Promise<RuntimeProcessRecord | null> {
  const value = await readJson(processRecordPath(ctx, registryPath)).catch(() => null);
  if (!isRecord(value)) return null;
  const pid = numberField(value.pid);
  const port = numberField(value.port);
  const host = stringField(value.host);
  const appName = stringField(value.appName);
  const command = stringField(value.command);
  const startedAt = stringField(value.startedAt);
  const stubFingerprint = stringField(value.stubFingerprint) || undefined;
  const lastMessageSendProbe = messageSendProbeField(value.lastMessageSendProbe);
  if (!pid || port !== ctx.port || host !== ctx.host) return null;
  return { pid, port, host, appName, command, startedAt, stubFingerprint, lastMessageSendProbe };
}

export async function clearProcessRecord(ctx: RuntimeRecordContext, registryPath: string): Promise<void> {
  await unlink(processRecordPath(ctx, registryPath)).catch(() => undefined);
}

export async function isFile(path: string): Promise<boolean> {
  return await stat(path)
    .then((s) => s.isFile())
    .catch(() => false);
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (hasErrorCode(error, "EPERM")) return true;
    if (hasErrorCode(error, "ESRCH")) return false;
    throw error;
  }
}

export async function terminatePid(pid: number): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]).catch(() => undefined);
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
    return;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (hasErrorCode(error, "EINVAL")) return;
    if (!hasErrorCode(error, "ESRCH") && !hasErrorCode(error, "EPERM")) throw error;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (hasErrorCode(error, "ESRCH") || hasErrorCode(error, "EPERM")) return;
    throw error;
  }
}

export async function waitForPidExit(pid: number, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return;
    await delay(100);
  }
}

export function isTcpPortListening(host: string, port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(value);
    };
    socket.setTimeout(300, () => settle(false));
    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
  });
}

export async function runtimeStubFingerprint(stubDir: string): Promise<string> {
  const files = await collectRuntimeStubFiles(stubDir, stubDir);
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.path);
    hash.update("\0");
    hash.update(await readFile(join(stubDir, file.path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function tail(value: string, max = 20_000): string {
  return value.length > max ? value.slice(-max) : value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasErrorCode(error: Error, code: string): boolean {
  return isRecord(error) && error.code === code;
}

function processRecordPath(ctx: RuntimeRecordContext, registryPath: string): string {
  return join(ctx.stubDir, registryPath);
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberField(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

function messageSendProbeField(value: unknown): RuntimeProcessMessageSendProbe | undefined {
  if (!isRecord(value)) return undefined;
  if (!isMessageSendStatus(value.status)) return undefined;
  const checkedAt = stringField(value.checkedAt);
  if (!checkedAt) return undefined;
  return {
    status: value.status,
    taskState: nullableStringField(value.taskState),
    message: nullableStringField(value.message),
    taskId: nullableStringField(value.taskId),
    contextId: nullableStringField(value.contextId),
    resume: messageSendResumeField(value.resume),
    checkedAt
  };
}

function isMessageSendStatus(value: unknown): value is RuntimeProcessMessageSendProbe["status"] {
  return value === "not_checked" || value === "ready" || value === "working" || value === "interactive_required" || value === "failed";
}

function nullableStringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function messageSendResumeField(value: unknown): RuntimeA2aMessageSendResume | null {
  if (!isRecord(value)) return null;
  const taskId = nullableStringField(value.task_id);
  const contextId = nullableStringField(value.context_id);
  const interruptId = nullableStringField(value.interrupt_id);
  const functionName = nullableStringField(value.function_name);
  if (!taskId || !contextId || !interruptId || !functionName) return null;
  return {
    task_id: taskId,
    context_id: contextId,
    interrupt_id: interruptId,
    function_name: functionName,
    response_schema: value.response_schema ?? null
  };
}
