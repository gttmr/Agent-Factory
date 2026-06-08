import { spawn, type ChildProcessByStdio } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import type { ArtifactRootStore } from "./artifactRootStore";
import { buildRuntimeProcessEnv } from "./runtimeEnv";

export const DEFAULT_ADK_CHAT_PORT = 8765;
const DEFAULT_ADK_HOST = "127.0.0.1";

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
    const existing = this.liveProcess(reqId);
    if (existing) {
      return {
        ok: true,
        command: buildAdkServerCommand(ctx).display,
        status: await this.buildStatus(ctx)
      };
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
    return {
      ok: true,
      command: command.display,
      status: await this.buildStatus(ctx)
    };
  }

  async stop(reqId: string): Promise<RuntimeChatStopResult> {
    const proc = this.liveProcess(reqId);
    if (proc) {
      proc.exitCode = 0;
      if (proc.child.pid) {
        try {
          process.kill(-proc.child.pid, "SIGTERM");
        } catch {
          proc.child.kill("SIGTERM");
        }
      } else {
        proc.child.kill("SIGTERM");
      }
      proc.child.stdout.destroy();
      proc.child.stderr.destroy();
    }
    return {
      ok: true,
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
        status: live ? "running" : proc?.exitCode === null || proc?.exitCode === undefined ? "stopped" : proc.exitCode === 0 ? "stopped" : "failed",
        pid: live?.child.pid ?? null,
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

function baseUrl(ctx: { host: string; port: number }): string {
  return `http://${ctx.host}:${ctx.port}`;
}

function tail(value: string, max = 20_000): string {
  return value.length > max ? value.slice(-max) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
