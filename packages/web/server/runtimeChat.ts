import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, readlink, stat, unlink, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import { delimiter, join, posix, relative, resolve, win32 } from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import type { ArtifactRootStore } from "./artifactRootStore";
import { buildRuntimeProcessEnv } from "./runtimeEnv";
import { collectRuntimeStubFiles } from "./runtimeStubFiles";

export const DEFAULT_ADK_CHAT_PORT = 8765;
const DEFAULT_ADK_HOST = "127.0.0.1";
const RUNTIME_PROCESS_REGISTRY = ".adk/runtime-chat-process.json";
const STARTUP_PROBE_TIMEOUT_MS = 5_000;
const STARTUP_PROBE_INTERVAL_MS = 100;
const execFileAsync = promisify(execFile);

export interface RuntimeChatStatus {
  port: number;
  host: string;
  api_base_url: string;
  web_url: string;
  app_name: string;
  installed: boolean;
  install_supported: boolean;
  setup_hint: string;
  paths: {
    runtime_stub_dir: string;
    venv: string;
    python: string;
    adk: string;
  };
  server: {
    status: "stopped" | "running" | "failed";
    pid: number | null;
    managed: boolean;
    owner_matches_runtime: boolean;
    can_stop: boolean;
    stale: boolean;
    started_stub_fingerprint: string | null;
    current_stub_fingerprint: string | null;
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
  stubFingerprint: string;
}

interface RuntimeContext {
  reqId: string;
  repoRoot: string;
  stubDir: string;
  venvDir: string;
  venvBinDir: string;
  pythonPath: string;
  adkPath: string;
  appName: string;
  port: number;
  host: string;
}

interface RuntimeProcessRecord {
  pid: number;
  port: number;
  host: string;
  appName: string;
  command: string;
  startedAt: string;
  stubFingerprint?: string;
}

interface PortOwner {
  pid: number | null;
  command: string | null;
  cwd: string | null;
  matchesCurrentRuntime: boolean;
  safeToStop: boolean;
}

export interface AdkRuntimeVenvPaths {
  venvDir: string;
  binDir: string;
  pythonPath: string;
  adkPath: string;
}

export function resolveAdkRuntimeVenv({
  repoRoot,
  env = process.env,
  platform = process.platform
}: {
  repoRoot: string;
  env?: Partial<Pick<NodeJS.ProcessEnv, "AF_ADK_VENV_DIR">>;
  platform?: NodeJS.Platform;
}): AdkRuntimeVenvPaths {
  const configured = env.AF_ADK_VENV_DIR?.trim();
  const pathApi = platform === "win32" ? win32 : posix;
  const venvDir = configured
    ? pathApi.isAbsolute(configured)
      ? configured
      : pathApi.resolve(repoRoot, configured)
    : pathApi.join(repoRoot, ".agent-factory", "runtime", ".venv");
  const binDir = pathApi.join(venvDir, platform === "win32" ? "Scripts" : "bin");
  return {
    venvDir,
    binDir,
    pythonPath: pathApi.join(binDir, platform === "win32" ? "python.exe" : "python"),
    adkPath: pathApi.join(binDir, platform === "win32" ? "adk.exe" : "adk")
  };
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
    return {
      ok: false,
      command: "manual shared ADK runtime setup",
      stdout: "",
      stderr: setupHint(ctx),
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
    const portOwner = await findPortOwner(ctx);
    if (portOwner && !portOwner.matchesCurrentRuntime) {
      if (!portOwner.safeToStop || !portOwner.pid) {
        throw new Error(current.server.message ?? `ADK runtime port ${ctx.port} is already in use.`);
      }
      await terminatePid(portOwner.pid);
      await waitForPidExit(portOwner.pid);
    }
    const installed = await isFile(ctx.adkPath);
    if (!installed) {
      throw new Error(`Shared ADK runtime is not installed. ${setupHint(ctx)}`);
    }
    const command = buildAdkServerCommand(ctx);
    const env = await buildRuntimeProcessEnv({ repoRoot: this.repoRoot, stubDir: ctx.stubDir });
    const pathValue = env.PATH || process.env.PATH || "";
    const stubFingerprint = await runtimeStubFingerprint(ctx.stubDir);
    const child = spawn(command.command, command.args, {
      cwd: ctx.stubDir,
      env: {
        ...env,
        PATH: [ctx.venvBinDir, pathValue].filter(Boolean).join(delimiter),
        VIRTUAL_ENV: ctx.venvDir
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    const proc: RuntimeProcess = {
      child,
      port: ctx.port,
      host: ctx.host,
      stdout: "",
      stderr: "",
      exitCode: null,
      stubFingerprint
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
      startedAt: new Date().toISOString(),
      stubFingerprint
    });
    await waitForAdkAppReady(ctx, proc);
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
      if (proc.child.pid) await terminatePid(proc.child.pid);
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
      await terminatePid(record.pid);
      await waitForPidExit(record.pid);
      await clearProcessRecord(ctx);
      return {
        ok: true,
        message: "ADK runtime stop requested for the recorded process.",
        status: await this.status(reqId)
      };
    }

    const owner = await findPortOwner(ctx);
    if (owner?.safeToStop && owner.pid) {
      await terminatePid(owner.pid);
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
        message: owner.pid
          ? `Port ${ctx.port} is owned by PID ${owner.pid}, but it was not started from this runtime-stub.`
          : `Port ${ctx.port} is already in use, but the owner cannot be safely identified.`,
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
    const venv = resolveAdkRuntimeVenv({ repoRoot: this.repoRoot });
    return {
      reqId,
      repoRoot: this.repoRoot,
      stubDir,
      venvDir: venv.venvDir,
      venvBinDir: venv.binDir,
      pythonPath: venv.pythonPath,
      adkPath: venv.adkPath,
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
    const currentStubFingerprint = await runtimeStubFingerprint(ctx.stubDir).catch(() => null);
    const conflictMessage =
      portOwner && !portOwner.matchesCurrentRuntime
        ? portOwner.safeToStop
          ? `Port ${ctx.port} is already used by another ADK runtime${portOwner.pid ? ` (PID ${portOwner.pid})` : ""}. Starting this artifact will replace it.`
          : `Port ${ctx.port} is already in use${portOwner.pid ? ` by PID ${portOwner.pid}` : ""}. Stop that process or set AF_ADK_CHAT_PORT to another port.`
        : null;
    const runningPid = live?.child.pid ?? recordedLive?.pid ?? (portOwner?.matchesCurrentRuntime ? portOwner.pid : null);
    const managed = Boolean(live || recordedLive);
    const canStop = Boolean(live || recordedLive || portOwner?.safeToStop || proc);
    let serverStatus: RuntimeChatStatus["server"]["status"];
    if (live || recordedLive || portOwner?.matchesCurrentRuntime) {
      serverStatus = "running";
    } else if (portOwner) {
      serverStatus = "failed";
    } else if (proc?.exitCode === null || proc?.exitCode === undefined || proc.exitCode === 0) {
      serverStatus = "stopped";
    } else {
      serverStatus = "failed";
    }
    const startedStubFingerprint = live?.stubFingerprint ?? recordedLive?.stubFingerprint ?? null;
    return {
      port: ctx.port,
      host: ctx.host,
      api_base_url: baseUrl(ctx),
      web_url: baseUrl(ctx),
      app_name: ctx.appName,
      installed: (await isFile(ctx.pythonPath)) && (await isFile(ctx.adkPath)),
      install_supported: false,
      setup_hint: setupHint(ctx),
      paths: {
        runtime_stub_dir: ctx.stubDir,
        venv: ctx.venvDir,
        python: ctx.pythonPath,
        adk: ctx.adkPath
      },
      server: {
        status: serverStatus,
        pid: runningPid,
        managed,
        owner_matches_runtime: Boolean(live || recordedLive || portOwner?.matchesCurrentRuntime),
        can_stop: canStop,
        stale:
          serverStatus === "running" &&
          Boolean(startedStubFingerprint && currentStubFingerprint && startedStubFingerprint !== currentStubFingerprint),
        started_stub_fingerprint: startedStubFingerprint,
        current_stub_fingerprint: currentStubFingerprint,
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

export function buildAdkServerCommand(input: { adkPath: string; host: string; port: number }) {
  const command = input.adkPath;
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
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
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
  const stubFingerprint = typeof value.stubFingerprint === "string" ? value.stubFingerprint : undefined;
  if (!Number.isInteger(pid) || pid <= 0 || port !== ctx.port || host !== ctx.host) return null;
  return { pid, port, host, appName, command, startedAt, stubFingerprint };
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

async function terminatePid(pid: number): Promise<void> {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]).catch(() => undefined);
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
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
  if (!(await isTcpPortListening(ctx.host, ctx.port))) return null;
  const processInfo = await findListeningProcess(ctx.port);
  if (!processInfo) {
    return {
      pid: null,
      command: null,
      cwd: null,
      matchesCurrentRuntime: false,
      safeToStop: false
    };
  }
  const command = (await readProcessCommand(processInfo.pid)) ?? processInfo.command;
  const cwd = await readProcessCwd(processInfo.pid);
  const matchesCurrentRuntime = Boolean(cwd && isSamePath(cwd, ctx.stubDir) && isAdkApiServerCommand(command, ctx.adkPath));
  const safeToStop = Boolean(
    cwd && !matchesCurrentRuntime && isArtifactRuntimeStubPath(ctx.repoRoot, cwd) && isAdkApiServerCommand(command, ctx.adkPath)
  );
  return {
    pid: processInfo.pid,
    command,
    cwd,
    matchesCurrentRuntime,
    safeToStop
  };
}

async function findListeningProcess(port: number): Promise<{ pid: number; command: string | null } | null> {
  const result = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-FpPc"]).catch(() => null);
  if (!result) return null;
  let pid: number | null = null;
  let command: string | null = null;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.startsWith("p")) pid = positiveInteger(line.slice(1));
    else if (line.startsWith("c")) command = line.slice(1).trim() || null;
    if (pid) return { pid, command };
  }
  return null;
}

async function readProcessCwd(pid: number): Promise<string | null> {
  if (process.platform === "win32") return null;
  return await readlink(`/proc/${pid}/cwd`).catch(() => null);
}

async function readProcessCommand(pid: number): Promise<string | null> {
  if (process.platform === "win32") return null;
  const value = await readFile(`/proc/${pid}/cmdline`, "utf8").catch(() => "");
  const command = value
    .split("\0")
    .filter(Boolean)
    .join(" ")
    .trim();
  return command || null;
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isSamePath(left: string, right: string): boolean {
  return resolve(left) === resolve(right);
}

function isArtifactRuntimeStubPath(repoRoot: string, value: string): boolean {
  const runtimeRoot = resolve(repoRoot, "artifacts", "af");
  const target = resolve(value);
  const childPath = relative(runtimeRoot, target);
  const pathParts = target.split(/[\\/]/);
  return childPath !== "" && !childPath.startsWith("..") && !childPath.startsWith("/") && pathParts[pathParts.length - 1] === "runtime-stub";
}

function isAdkApiServerCommand(command: string | null, adkPath: string): boolean {
  if (!command) return false;
  return command.includes(" api_server ") && (command.includes(adkPath) || /(^|\s)adk(\s|$)/.test(command));
}

function isTcpPortListening(host: string, port: number): Promise<boolean> {
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

async function waitForAdkAppReady(ctx: RuntimeContext, proc: RuntimeProcess): Promise<void> {
  const deadline = Date.now() + STARTUP_PROBE_TIMEOUT_MS;
  let lastMessage = "ADK Web is not reachable yet.";
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`ADK runtime exited before ${ctx.appName} was ready. ${tail(proc.stderr || proc.stdout || "", 1_000)}`);
    }
    const probe = await probeAdkAppList(ctx);
    if (probe.ready) return;
    lastMessage = probe.message;
    await delay(STARTUP_PROBE_INTERVAL_MS);
  }
  throw new Error(`ADK runtime did not expose ${ctx.appName} on ${baseUrl(ctx)}/list-apps. ${lastMessage}`);
}

async function probeAdkAppList(ctx: RuntimeContext): Promise<{ readonly ready: boolean; readonly message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const response = await fetch(`${baseUrl(ctx)}/list-apps`, { signal: controller.signal });
    if (!response.ok) return { ready: false, message: `/list-apps returned HTTP ${response.status}.` };
    const value: unknown = await response.json();
    if (Array.isArray(value) && value.includes(ctx.appName)) return { ready: true, message: "ready" };
    return { ready: false, message: `/list-apps returned ${JSON.stringify(value)}.` };
  } catch (error) {
    if (error instanceof Error) return { ready: false, message: error.message };
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function baseUrl(ctx: { host: string; port: number }): string {
  return `http://${ctx.host}:${ctx.port}`;
}

function tail(value: string, max = 20_000): string {
  return value.length > max ? value.slice(-max) : value;
}

async function runtimeStubFingerprint(stubDir: string): Promise<string> {
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

function setupHint(ctx: Pick<RuntimeContext, "venvDir" | "pythonPath">): string {
  return [
    `Create the shared ADK runtime venv at ${ctx.venvDir}.`,
    `Then run: ${ctx.pythonPath} -m pip install -r requirements/adk-runtime.txt.`
  ].join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
