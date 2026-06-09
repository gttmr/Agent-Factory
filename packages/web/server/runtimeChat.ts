import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import { mkdir, readdir, readFile, readlink, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import type { ArtifactRootStore } from "./artifactRootStore";
import { buildRuntimeProcessEnv } from "./runtimeEnv";

export const DEFAULT_ADK_CHAT_PORT = 8765;
const DEFAULT_ADK_HOST = "127.0.0.1";
const RUNTIME_PROCESS_REGISTRY = ".adk/runtime-chat-process.json";
const execFileAsync = promisify(execFile);

export interface RuntimeChatStatus {
  port: number;
  host: string;
  api_base_url: string;
  web_url: string;
  app_name: string;
  installed: boolean;
  paths: {
    runtime_stub_dir: string;
    python: string;
    adk: string;
  };
  server: {
    status: "stopped" | "running" | "failed";
    pid: number | null;
    managed: boolean;
    owner_matches_runtime: boolean;
    can_stop: boolean;
    message: string | null;
    port_owner_pid: number | null;
    port_owner_command: string | null;
    exit_code: number | null;
    stdout_tail: string;
    stderr_tail: string;
  };
}

export interface RuntimeChatInstallResult {
  ok: boolean;
  command: string;
  stdout: string;
  stderr: string;
  status: RuntimeChatStatus;
}

export interface RuntimeChatStartResult {
  ok: boolean;
  command: string;
  status: RuntimeChatStatus;
}

export interface RuntimeChatStopResult {
  ok: boolean;
  message: string | null;
  status: RuntimeChatStatus;
}

export interface RuntimeChatManagerOptions {
  repoRoot: string;
  store: ArtifactRootStore;
  port?: number;
  host?: string;
}

interface RuntimeProcess {
  child: ChildProcessByStdio<null, Readable, Readable>;
  port: number;
  host: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

interface RuntimeContext {
  reqId: string;
  stubDir: string;
  pythonPath: string;
  adkPath: string;
  appName: string;
  port: number;
  host: string;
}

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface RuntimeProcessRecord {
  pid: number;
  port: number;
  host: string;
  appName: string;
  command: string;
  startedAt: string;
}

interface PortOwner {
  pid: number;
  command: string | null;
  cwd: string | null;
  matchesCurrentRuntime: boolean;
  safeToStop: boolean;
}

export class RuntimeChatManager {
  private readonly repoRoot: string;
  private readonly store: ArtifactRootStore;
  private readonly port: number;
  private readonly host: string;
  private readonly processes = new Map<string, RuntimeProcess>();

  constructor(opts: RuntimeChatManagerOptions) {
    this.repoRoot = opts.repoRoot;
    this.store = opts.store;
    this.port = normalizePort(opts.port ?? Number(process.env.AF_ADK_CHAT_PORT || DEFAULT_ADK_CHAT_PORT));
    this.host = opts.host ?? process.env.AF_ADK_CHAT_HOST ?? DEFAULT_ADK_HOST;
  }

  async status(reqId: string): Promise<RuntimeChatStatus> {
    return await this.buildStatus(await this.context(reqId));
  }

  async install(reqId: string): Promise<RuntimeChatInstallResult> {
    const ctx = await this.context(reqId);
    const createVenv = await runProcess(ctx.stubDir, "python3", ["-m", "venv", ".venv"]);
    if (createVenv.code !== 0) {
      return {
        ok: false,
        command: "python3 -m venv .venv",
        stdout: createVenv.stdout,
        stderr: createVenv.stderr,
        status: await this.buildStatus(ctx)
      };
    }
    const install = await runProcess(ctx.stubDir, ctx.pythonPath, ["-m", "pip", "install", "-r", "requirements.txt"]);
    return {
      ok: install.code === 0,
      command: `${ctx.pythonPath} -m pip install -r requirements.txt`,
      stdout: install.stdout,
      stderr: install.stderr,
      status: await this.buildStatus(ctx)
    };
  }

  async start(reqId: string): Promise<RuntimeChatStartResult> {
    const ctx = await this.context(reqId);
    const current = await this.buildStatus(ctx);
    if (current.server.status === "running" && (current.server.managed || current.server.owner_matches_runtime)) {
      return {
        ok: true,
        command: buildAdkServerCommand(ctx).display,
        status: current
      };
    }
    if (current.server.port_owner_pid && !current.server.can_stop) {
      throw new Error(current.server.message ?? `ADK runtime port ${ctx.port} is already in use.`);
    }
    const installed = await isFile(ctx.adkPath);
    if (!installed) {
      throw new Error("ADK dependency is not installed. Run runtime-chat/install first.");
    }
    const command = buildAdkServerCommand(ctx);
    const env = await buildRuntimeProcessEnv({ repoRoot: this.repoRoot, stubDir: ctx.stubDir });
    const child = spawn(command.command, command.args, {
      cwd: ctx.stubDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true
    });
    const proc: RuntimeProcess = {
      child,
      port: ctx.port,
      host: ctx.host,
      stdout: "",
      stderr: "",
      exitCode: null
    };
    child.stdout.on("data", (chunk: Buffer) => {
      proc.stdout = tail(`${proc.stdout}${chunk.toString("utf8")}`);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      proc.stderr = tail(`${proc.stderr}${chunk.toString("utf8")}`);
    });
    child.on("exit", (code) => {
      proc.exitCode = code ?? -1;
    });
    this.processes.set(reqId, proc);
    await writeProcessRecord(ctx, {
      pid: child.pid ?? -1,
      port: ctx.port,
      host: ctx.host,
      appName: ctx.appName,
      command: command.display,
      startedAt: new Date().toISOString()
    });
    return {
      ok: true,
      command: command.display,
      status: await this.buildStatus(ctx)
    };
  }

  async stop(reqId: string): Promise<RuntimeChatStopResult> {
    const ctx = await this.context(reqId);
    const proc = this.liveProcess(reqId);
    if (proc) {
      proc.exitCode = 0;
      if (proc.child.pid) terminatePid(proc.child.pid);
      else proc.child.kill("SIGTERM");
      proc.child.stdout.destroy();
      proc.child.stderr.destroy();
      await waitForPidExit(proc.child.pid ?? null);
      this.processes.delete(reqId);
      await clearProcessRecord(ctx);
      return {
        ok: true,
        message: "ADK runtime stop requested.",
        status: await this.status(reqId)
      };
    }

    const record = await readProcessRecord(ctx);
    if (record && isPidAlive(record.pid)) {
      terminatePid(record.pid);
      await waitForPidExit(record.pid);
      await clearProcessRecord(ctx);
      return {
        ok: true,
        message: "ADK runtime stop requested for the recorded process.",
        status: await this.status(reqId)
      };
    }

    const owner = await findPortOwner(ctx);
    if (owner?.safeToStop) {
      terminatePid(owner.pid);
      await waitForPidExit(owner.pid);
      await clearProcessRecord(ctx);
      return {
        ok: true,
        message: "ADK runtime stop requested for the process listening on the runtime port.",
        status: await this.status(reqId)
      };
    }

    this.processes.delete(reqId);
    await clearProcessRecord(ctx);
    if (owner) {
      return {
        ok: false,
        message: `Port ${ctx.port} is owned by PID ${owner.pid}, but it was not started from this runtime-stub.`,
        status: await this.status(reqId)
      };
    }
    return {
      ok: true,
      message: "No ADK runtime process was running.",
      status: await this.status(reqId)
    };
  }

  private async context(reqId: string): Promise<RuntimeContext> {
    const rootDir = this.store.resolveRootDir(reqId);
    const stubDir = join(rootDir, "runtime-stub");
    const appName = await discoverAppName(stubDir);
    return {
      reqId,
      stubDir,
      pythonPath: join(stubDir, ".venv/bin/python"),
      adkPath: join(stubDir, ".venv/bin/adk"),
      appName,
      port: this.port,
      host: this.host
    };
  }

  private async buildStatus(ctx: RuntimeContext): Promise<RuntimeChatStatus> {
    const proc = this.processes.get(ctx.reqId);
    const live = proc && proc.exitCode === null ? proc : null;
    const record = live ? null : await readProcessRecord(ctx);
    const recordedLive = record && isPidAlive(record.pid) ? record : null;
    const portOwner = live || recordedLive ? null : await findPortOwner(ctx);
    const conflictMessage =
      portOwner && !portOwner.matchesCurrentRuntime
        ? portOwner.safeToStop
          ? `Port ${ctx.port} is already used by another ADK runtime (PID ${portOwner.pid}). Stop it before starting this artifact.`
          : `Port ${ctx.port} is already in use by PID ${portOwner.pid}. Stop that process or set AF_ADK_CHAT_PORT to another port.`
        : null;
    const runningPid = live?.child.pid ?? recordedLive?.pid ?? (portOwner?.matchesCurrentRuntime ? portOwner.pid : null);
    const managed = Boolean(live || recordedLive);
    const canStop = Boolean(live || recordedLive || portOwner?.safeToStop || proc);
    const serverStatus =
      live || recordedLive || portOwner?.matchesCurrentRuntime
        ? "running"
        : portOwner
          ? "failed"
          : proc?.exitCode === null || proc?.exitCode === undefined
            ? "stopped"
            : proc.exitCode === 0
              ? "stopped"
              : "failed";
    return {
      port: ctx.port,
      host: ctx.host,
      api_base_url: baseUrl(ctx),
      web_url: baseUrl(ctx),
      app_name: ctx.appName,
      installed: (await isFile(ctx.pythonPath)) && (await isFile(ctx.adkPath)),
      paths: {
        runtime_stub_dir: ctx.stubDir,
        python: ctx.pythonPath,
        adk: ctx.adkPath
      },
      server: {
        status: serverStatus,
        pid: runningPid,
        managed,
        owner_matches_runtime: Boolean(live || recordedLive || portOwner?.matchesCurrentRuntime),
        can_stop: canStop,
        message: conflictMessage,
        port_owner_pid: portOwner?.pid ?? null,
        port_owner_command: portOwner?.command ?? null,
        exit_code: proc?.exitCode ?? null,
        stdout_tail: proc?.stdout ?? "",
        stderr_tail: proc?.stderr ?? ""
      }
    };
  }

  private liveProcess(reqId: string): RuntimeProcess | null {
    const proc = this.processes.get(reqId);
    return proc && proc.exitCode === null ? proc : null;
  }
}

export function buildAdkServerCommand(input: { stubDir: string; host: string; port: number }) {
  const command = join(input.stubDir, ".venv/bin/adk");
  const args = [
    "api_server",
    "--host",
    input.host,
    "--port",
    String(input.port),
    "--session_service_uri",
    "memory://",
    "--artifact_service_uri",
    "memory://",
    "--no-reload",
    "--with_ui",
    "."
  ];
  return {
    command,
    args,
    display: `${command} ${args.join(" ")}`
  };
}

export function extractFinalTextFromAdkEvents(events: unknown[]): string {
  for (const event of [...events].reverse()) {
    if (!isRecord(event) || !isRecord(event.content) || !Array.isArray(event.content.parts)) continue;
    const text = event.content.parts
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

async function discoverAppName(stubDir: string): Promise<string> {
  const entries = await readdir(stubDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const manifestPath = join(stubDir, entry.name, "workflow_manifest.json");
    const manifest = await readJson(manifestPath).catch(() => null);
    if (isRecord(manifest) && typeof manifest.package === "string" && manifest.package.trim()) {
      return manifest.package;
    }
    if (await isFile(join(stubDir, entry.name, "agent.py"))) return entry.name;
  }
  throw new Error("runtime-stub agent package was not found.");
}

function runProcess(cwd: string, command: string, args: string[]): Promise<ProcessResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout = tail(`${stdout}${chunk.toString("utf8")}`, 200_000);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = tail(`${stderr}${chunk.toString("utf8")}`, 200_000);
    });
    child.on("error", (error) => {
      resolvePromise({ code: -1, stdout, stderr: `${stderr}\n[spawn-error] ${error.message}` });
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? -1, stdout, stderr });
    });
  });
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

async function isFile(path: string): Promise<boolean> {
  return await stat(path)
    .then((s) => s.isFile())
    .catch(() => false);
}

function normalizePort(value: number): number {
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : DEFAULT_ADK_CHAT_PORT;
}

function processRecordPath(ctx: RuntimeContext): string {
  return join(ctx.stubDir, RUNTIME_PROCESS_REGISTRY);
}

async function writeProcessRecord(ctx: RuntimeContext, record: RuntimeProcessRecord): Promise<void> {
  if (!Number.isInteger(record.pid) || record.pid <= 0) return;
  const path = processRecordPath(ctx);
  await mkdir(join(ctx.stubDir, ".adk"), { recursive: true });
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

async function readProcessRecord(ctx: RuntimeContext): Promise<RuntimeProcessRecord | null> {
  const value = await readJson(processRecordPath(ctx)).catch(() => null);
  if (!isRecord(value)) return null;
  const pid = typeof value.pid === "number" ? value.pid : NaN;
  const port = typeof value.port === "number" ? value.port : NaN;
  const host = typeof value.host === "string" ? value.host : "";
  const appName = typeof value.appName === "string" ? value.appName : "";
  const command = typeof value.command === "string" ? value.command : "";
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
  if (!Number.isInteger(pid) || pid <= 0 || port !== ctx.port || host !== ctx.host) return null;
  return { pid, port, host, appName, command, startedAt };
}

async function clearProcessRecord(ctx: RuntimeContext): Promise<void> {
  await unlink(processRecordPath(ctx)).catch(() => undefined);
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isRecord(error) && error.code === "EPERM";
  }
}

function terminatePid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(-pid, "SIGTERM");
    return;
  } catch {
    // Fall back to the individual PID when it is not a process-group leader.
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Already stopped.
  }
}

async function waitForPidExit(pid: number | null, timeoutMs = 2_000): Promise<void> {
  if (!pid) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPidAlive(pid)) return;
    await delay(100);
  }
}

async function findPortOwner(ctx: RuntimeContext): Promise<PortOwner | null> {
  const pids = await findListeningPids(ctx.port);
  for (const pid of pids) {
    const owner = await inspectProcessOwner(pid, ctx);
    if (owner) return owner;
  }
  return null;
}

async function findListeningPids(port: number): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], {
      encoding: "utf8"
    });
    return stdout
      .split("\n")
      .filter((line) => line.startsWith("p"))
      .map((line) => Number(line.slice(1)))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

async function inspectProcessOwner(pid: number, ctx: RuntimeContext): Promise<PortOwner | null> {
  if (!isPidAlive(pid)) return null;
  const cwd = await readlink(`/proc/${pid}/cwd`).catch(() => null);
  const command = await readFile(`/proc/${pid}/cmdline`, "utf8")
    .then((value) => value.split("\0").filter(Boolean).join(" "))
    .catch(() => null);
  const matchesCurrentRuntime = isCurrentRuntimeProcessOwner({ command, cwd }, ctx);
  const safeToStop = matchesCurrentRuntime || isAdkRuntimeProcessOwner({ command }, ctx);
  return {
    pid,
    command,
    cwd,
    matchesCurrentRuntime,
    safeToStop
  };
}

function isCurrentRuntimeProcessOwner(owner: { command: string | null; cwd: string | null }, ctx: RuntimeContext): boolean {
  const cwd = owner.cwd ?? "";
  const command = owner.command ?? "";
  if (cwd === ctx.stubDir) return true;
  return command.includes(ctx.stubDir) && command.includes("api_server") && command.includes(".venv/bin/adk");
}

function isAdkRuntimeProcessOwner(owner: { command: string | null }, ctx: RuntimeContext): boolean {
  const command = owner.command ?? "";
  return (
    command.includes("api_server") &&
    command.includes(".venv/bin/adk") &&
    command.includes("--port") &&
    command.includes(String(ctx.port))
  );
}

function baseUrl(ctx: { host: string; port: number }): string {
  return `http://${ctx.host}:${ctx.port}`;
}

function tail(value: string, max = 20_000): string {
  return value.length > max ? value.slice(-max) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
