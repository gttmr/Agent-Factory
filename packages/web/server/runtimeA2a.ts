import { spawn, type ChildProcessByStdio } from "node:child_process";
import { delimiter, join } from "node:path";
import type { Readable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import type { ArtifactRootStore } from "./artifactRootStore";
import { buildRuntimeProcessEnv } from "./runtimeEnv";
import { a2aLauncherPath, buildAdkA2aServerCommand } from "./runtimeA2aCommand";
import { discoverAppName, refreshAgentCard } from "./runtimeA2aCard";
import { mockLabPrerequisites } from "./runtimeA2aMockLabPrerequisites";
import { notCheckedMessageSendProbe, probeAgentCard, probeMessageSend, unavailableAgentCardProbe, type MessageSendProbe } from "./runtimeA2aProbe";
import type { RuntimeA2aAgentCardResult, RuntimeA2aManagerOptions, RuntimeA2aStartResult, RuntimeA2aStatus, RuntimeA2aStopResult } from "./runtimeA2aTypes";
import {
  clearProcessRecord,
  isFile,
  isPidAlive,
  isTcpPortListening,
  readProcessRecord,
  type RuntimeProcessMessageSendProbe,
  runtimeStubFingerprint,
  tail,
  terminatePid,
  waitForPidExit,
  writeProcessRecord
} from "./runtimeProcessControl";
import { resolveAdkRuntimeVenv } from "./runtimeChat";

export const DEFAULT_ADK_A2A_PORT = 8001;
const DEFAULT_ADK_A2A_HOST = "127.0.0.1";
const A2A_PROCESS_REGISTRY = ".adk/runtime-a2a-process.json";
const AGENT_CARD_PATH = ".well-known/agent-card.json";
const DEFAULT_STARTUP_PROBE_TIMEOUT_MS = 5_000;
const DEFAULT_STATUS_PROBE_TIMEOUT_MS = 5_000;
const DEFAULT_SEMANTIC_PROBE_TIMEOUT_MS = 20_000;

export { buildAdkA2aServerCommand };

interface RuntimeProcess {
  child: ChildProcessByStdio<null, Readable, Readable>;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  stubFingerprint: string;
  lastMessageSendProbe: MessageSendProbe | null;
}

interface RuntimeContext {
  reqId: string;
  stubDir: string;
  appName: string;
  venvDir: string;
  venvBinDir: string;
  pythonPath: string;
  adkPath: string;
  port: number;
  host: string;
}

export class RuntimeA2aManager {
  private readonly repoRoot: string;
  private readonly store: ArtifactRootStore;
  private readonly port: number;
  private readonly host: string;
  private readonly startupProbeTimeoutMs: number;
  private readonly statusProbeTimeoutMs: number;
  private readonly processes = new Map<string, RuntimeProcess>();

  constructor(opts: RuntimeA2aManagerOptions) {
    this.repoRoot = opts.repoRoot;
    this.store = opts.store;
    this.port = normalizePort(opts.port ?? Number(process.env.AF_ADK_A2A_PORT || DEFAULT_ADK_A2A_PORT));
    this.host = opts.host ?? process.env.AF_ADK_A2A_HOST ?? DEFAULT_ADK_A2A_HOST;
    this.startupProbeTimeoutMs = normalizeTimeout(opts.startupProbeTimeoutMs, DEFAULT_STARTUP_PROBE_TIMEOUT_MS);
    this.statusProbeTimeoutMs = normalizeTimeout(opts.statusProbeTimeoutMs, DEFAULT_STATUS_PROBE_TIMEOUT_MS);
  }

  async status(reqId: string): Promise<RuntimeA2aStatus> {
    return await this.buildStatus(await this.context(reqId), { semanticProbe: "cached" });
  }

  async agentCard(reqId: string): Promise<RuntimeA2aAgentCardResult> {
    const ctx = await this.context(reqId);
    const card = await refreshAgentCard({ stubDir: ctx.stubDir, appName: ctx.appName, rpcUrl: rpcUrl(ctx) });
    return { provider_req_id: reqId, app_name: ctx.appName, rpc_url: rpcUrl(ctx), agent_card_url: agentCardUrl(ctx), card };
  }

  async start(reqId: string): Promise<RuntimeA2aStartResult> {
    const ctx = await this.context(reqId);
    const current = await this.buildStatus(ctx, { semanticProbe: "cached" });
    if (current.server.mock_lab_prerequisites.some((prerequisite) => !prerequisite.running)) {
      return { ok: false, command: buildAdkA2aServerCommand(ctx).display, status: current };
    }
    if (current.server.status === "running" && current.server.can_stop) {
      const status = await this.buildStatus(ctx, { semanticProbe: "active" });
      return { ok: status.server.status === "running", command: buildAdkA2aServerCommand(ctx).display, status };
    }
    if (await isTcpPortListening(ctx.host, ctx.port)) {
      throw new Error(`ADK A2A provider port ${ctx.port} is already in use.`);
    }
    if (!(await isFile(ctx.adkPath))) throw new Error(`Shared ADK runtime is not installed. ${setupHint(ctx)}`);
    if (!(await isFile(a2aLauncherPath(ctx)))) throw new Error("ADK A2A launcher is missing. Regenerate runtime-stub before starting the provider.");

    await refreshAgentCard({ stubDir: ctx.stubDir, appName: ctx.appName, rpcUrl: rpcUrl(ctx) });
    const command = buildAdkA2aServerCommand(ctx);
    const env = await buildRuntimeProcessEnv({ repoRoot: this.repoRoot, stubDir: ctx.stubDir });
    const pathValue = env.PATH || process.env.PATH || "";
    const stubFingerprint = await runtimeStubFingerprint(ctx.stubDir);
    const child = spawn(command.command, command.args, {
      cwd: ctx.stubDir,
      env: { ...env, PATH: [ctx.venvBinDir, pathValue].filter(Boolean).join(delimiter), VIRTUAL_ENV: ctx.venvDir },
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32"
    });
    const proc: RuntimeProcess = { child, stdout: "", stderr: "", exitCode: null, stubFingerprint, lastMessageSendProbe: null };
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
    await writeProcessRecord(ctx, A2A_PROCESS_REGISTRY, {
      pid: child.pid ?? -1,
      port: ctx.port,
      host: ctx.host,
      appName: ctx.appName,
      command: command.display,
      startedAt: new Date().toISOString(),
      stubFingerprint
    });
    await waitForAgentCardReady(ctx, proc, this.startupProbeTimeoutMs);
    const status = await this.buildStatus(ctx, { semanticProbe: "active" });
    return { ok: status.server.status === "running", command: command.display, status };
  }

  async stop(reqId: string): Promise<RuntimeA2aStopResult> {
    const ctx = await this.context(reqId);
    const proc = this.processes.get(reqId);
    if (proc?.child.pid) return await this.stopLiveProcess(reqId, ctx, proc);
    const record = await readProcessRecord(ctx, A2A_PROCESS_REGISTRY);
    if (record && isPidAlive(record.pid)) {
      await terminatePid(record.pid);
      await waitForPidExit(record.pid);
      await clearProcessRecord(ctx, A2A_PROCESS_REGISTRY);
      return { ok: true, message: "ADK A2A provider stop requested for the recorded process.", status: await this.status(reqId) };
    }
    await clearProcessRecord(ctx, A2A_PROCESS_REGISTRY);
    return { ok: true, message: "No ADK A2A provider process was running.", status: await this.status(reqId) };
  }

  private async stopLiveProcess(reqId: string, ctx: RuntimeContext, proc: RuntimeProcess): Promise<RuntimeA2aStopResult> {
    proc.exitCode = 0;
    await terminatePid(proc.child.pid ?? 0);
    proc.child.stdout.destroy();
    proc.child.stderr.destroy();
    await waitForPidExit(proc.child.pid ?? 0);
    this.processes.delete(reqId);
    await clearProcessRecord(ctx, A2A_PROCESS_REGISTRY);
    return { ok: true, message: "ADK A2A provider stop requested.", status: await this.status(reqId) };
  }

  private async context(reqId: string): Promise<RuntimeContext> {
    const rootDir = this.store.resolveRootDir(reqId);
    const stubDir = join(rootDir, "runtime-stub");
    const appName = await discoverAppName(stubDir);
    const venv = resolveAdkRuntimeVenv({ repoRoot: this.repoRoot });
    return {
      reqId,
      stubDir,
      appName,
      venvDir: venv.venvDir,
      venvBinDir: venv.binDir,
      pythonPath: venv.pythonPath,
      adkPath: venv.adkPath,
      port: this.port,
      host: this.host
    };
  }

  private async buildStatus(ctx: RuntimeContext, opts: { readonly semanticProbe: "cached" | "active" }): Promise<RuntimeA2aStatus> {
    const proc = this.processes.get(ctx.reqId);
    const live = proc && proc.exitCode === null ? proc : null;
    const record = live ? null : await readProcessRecord(ctx, A2A_PROCESS_REGISTRY);
    const recordedLive = record && isPidAlive(record.pid) ? record : null;
    const currentStubFingerprint = await runtimeStubFingerprint(ctx.stubDir).catch(() => null);
    const startedStubFingerprint = live?.stubFingerprint ?? recordedLive?.stubFingerprint ?? null;
    const running = Boolean(live || recordedLive);
    const prerequisites = await mockLabPrerequisites({ repoRoot: this.repoRoot, stubDir: ctx.stubDir });
    const blockedPrerequisite = prerequisites.find((prerequisite) => !prerequisite.running) ?? null;
    const probe = running ? await probeAgentCard({ url: agentCardUrl(ctx), appName: ctx.appName, timeoutMs: this.statusProbeTimeoutMs }) : unavailableAgentCardProbe(null);
    const semanticProbe = await this.semanticStatusProbe(ctx, {
      live,
      recordedLive,
      canProbe: running && probe.ready && !blockedPrerequisite,
      mode: opts.semanticProbe
    });
    const setupFailure = a2aSetupFailureMessage(proc?.stderr ?? "");
    const prerequisiteFailure = blockedPrerequisite?.message ?? null;
    const semanticFailure = semanticProbe.status === "failed" ? semanticProbe.message : null;
    const semanticMessage = semanticProbe.status === "interactive_required" ? semanticProbe.message : null;
    const processFailure = prerequisiteFailure ?? setupFailure ?? (running && !probe.ready ? probe.message : null);
    return {
      port: ctx.port,
      host: ctx.host,
      rpc_url: rpcUrl(ctx),
      agent_card_url: agentCardUrl(ctx),
      web_url: baseUrl(ctx),
      app_name: ctx.appName,
      installed: (await isFile(ctx.pythonPath)) && (await isFile(ctx.adkPath)),
      setup_hint: setupHint(ctx),
      paths: { runtime_stub_dir: ctx.stubDir, venv: ctx.venvDir, python: ctx.pythonPath, adk: ctx.adkPath },
      server: {
        status: processFailure ? "failed" : running ? "running" : proc?.exitCode && proc.exitCode !== 0 ? "failed" : "stopped",
        pid: live?.child.pid ?? recordedLive?.pid ?? null,
        can_stop: Boolean(live || recordedLive),
        stale: running && Boolean(startedStubFingerprint && currentStubFingerprint && startedStubFingerprint !== currentStubFingerprint),
        agent_card_ready: running ? probe.ready : false,
        agent_card_status_code: probe.statusCode,
        message: processFailure ?? semanticFailure ?? semanticMessage,
        message_send_ready: semanticProbe.status === "ready",
        message_send_status: semanticProbe.status,
        message_send_task_state: semanticProbe.taskState,
        mock_lab_prerequisites: prerequisites,
        started_stub_fingerprint: startedStubFingerprint,
        current_stub_fingerprint: currentStubFingerprint,
        stdout_tail: proc?.stdout ?? "",
        stderr_tail: proc?.stderr ?? ""
      }
    };
  }

  private async semanticStatusProbe(
    ctx: RuntimeContext,
    opts: {
      readonly live: RuntimeProcess | null;
      readonly recordedLive: Awaited<ReturnType<typeof readProcessRecord>>;
      readonly canProbe: boolean;
      readonly mode: "cached" | "active";
    }
  ): Promise<MessageSendProbe> {
    if (!opts.canProbe) return notCheckedMessageSendProbe();
    if (opts.mode === "cached") {
      return opts.live?.lastMessageSendProbe ?? messageSendProbeFromRecord(opts.recordedLive?.lastMessageSendProbe) ?? notCheckedMessageSendProbe();
    }
    const probe = await probeMessageSend({ url: rpcUrl(ctx), timeoutMs: Math.max(this.statusProbeTimeoutMs, DEFAULT_SEMANTIC_PROBE_TIMEOUT_MS) });
    if (opts.live) opts.live.lastMessageSendProbe = probe;
    await this.persistMessageSendProbe(ctx, probe);
    return probe;
  }

  private async persistMessageSendProbe(ctx: RuntimeContext, probe: MessageSendProbe): Promise<void> {
    const record = await readProcessRecord(ctx, A2A_PROCESS_REGISTRY);
    if (!record || !isPidAlive(record.pid)) return;
    await writeProcessRecord(ctx, A2A_PROCESS_REGISTRY, {
      ...record,
      lastMessageSendProbe: { ...probe, checkedAt: new Date().toISOString() }
    });
  }
}

function messageSendProbeFromRecord(probe: RuntimeProcessMessageSendProbe | undefined): MessageSendProbe | null {
  if (!probe) return null;
  return { status: probe.status, taskState: probe.taskState, message: probe.message };
}

function normalizePort(value: number): number {
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : DEFAULT_ADK_A2A_PORT;
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 50 && value <= 30_000 ? value : fallback;
}

async function waitForAgentCardReady(ctx: RuntimeContext, proc: RuntimeProcess, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (proc.exitCode !== null) return;
    if (a2aSetupFailureMessage(proc.stderr)) return;
    const probe = await probeAgentCard({ url: agentCardUrl(ctx), appName: ctx.appName, timeoutMs: Math.min(500, timeoutMs) });
    if (probe.ready) return;
    await delay(100);
  }
}

function a2aSetupFailureMessage(stderr: string): string | null {
  if (!stderr.includes("Failed to setup A2A agent")) return null;
  const line = stderr
    .split(/\r?\n/)
    .reverse()
    .find((entry) => entry.includes("Failed to setup A2A agent"));
  return line ? `ADK A2A setup failed: ${line.trim()}` : "ADK A2A setup failed.";
}

function rpcUrl(ctx: Pick<RuntimeContext, "host" | "port" | "appName">): string {
  return `${baseUrl(ctx)}/a2a/${ctx.appName}`;
}

function agentCardUrl(ctx: Pick<RuntimeContext, "host" | "port" | "appName">): string {
  return `${rpcUrl(ctx)}/${AGENT_CARD_PATH}`;
}

function baseUrl(ctx: Pick<RuntimeContext, "host" | "port">): string {
  return `http://${ctx.host}:${ctx.port}`;
}

function setupHint(ctx: Pick<RuntimeContext, "venvDir" | "pythonPath">): string {
  return `Create the shared ADK runtime venv at ${ctx.venvDir}. Then run: ${ctx.pythonPath} -m pip install -r requirements/adk-runtime.txt.`;
}
