import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { JsonRpcEnvelope, MockServerStatus } from "../src/types/mockSpec";
import { MockLabError, MockSpecStore, writeJsonFile } from "./mockSpecStore";

interface PendingRequest {
  resolve: (value: JsonRpcEnvelope & { result?: any }) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface ProcessEntry {
  mockId: string;
  child: ChildProcessWithoutNullStreams;
  status: MockServerStatus;
  stdoutBuffer: string;
  stdoutTail: string[];
  stderrTail: string[];
  pending: Map<string, PendingRequest>;
  nextId: number;
}

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const runtimePath = fileURLToPath(new URL("./mockSpecRuntime.ts", import.meta.url));
// `--loader` needs a URL, not a filesystem path. On Windows an absolute path
// like `C:\...` is parsed as a URL with scheme `c:` and rejected
// (ERR_UNSUPPORTED_ESM_URL_SCHEME), so pass the file:// URL form.
const loaderArg = new URL("../scripts/ts-extension-loader.mjs", import.meta.url).href;

export class MockProcessRegistry {
  private readonly processes = new Map<string, ProcessEntry>();
  private readonly options: {
    repoRoot: string;
    store: MockSpecStore;
  };

  constructor(options: { repoRoot: string; store: MockSpecStore }) {
    this.options = options;
  }

  async start(mockId: string): Promise<MockServerStatus> {
    if (this.processes.has(mockId)) throw new MockLabError(409, `mock server already running: ${mockId}`);
    await this.options.store.readSpec(mockId);

    const startedAt = new Date().toISOString();
    const command = "saved mock spec runtime";
    const child = spawn(process.execPath, ["--experimental-strip-types", "--loader", loaderArg, runtimePath], {
      cwd: packageRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        AFML_MOCK_ID: mockId,
        AFML_MOCK_SPEC: join(this.options.store.resolveMockDir(mockId), "mock-spec.json"),
        AFML_AUDIT_LOG: this.options.store.resolveAuditLog(mockId),
        MOCK_LAB_AUDIT_DIR: this.options.store.resolveMockDir(mockId),
        AFML_ARTIFACT_ROOT: this.options.store.resolveMockDir(mockId)
      }
    });
    const status: MockServerStatus = {
      mock_id: mockId,
      status: "running",
      pid: child.pid ?? null,
      started_at: startedAt,
      command,
      cwd: packageRoot,
      stdout_tail: [],
      stderr_tail: []
    };
    const entry: ProcessEntry = {
      mockId,
      child,
      status,
      stdoutBuffer: "",
      stdoutTail: [],
      stderrTail: [],
      pending: new Map(),
      nextId: 1
    };
    this.processes.set(mockId, entry);
    await this.writeState(entry);

    child.stdout.on("data", (chunk: Buffer) => this.handleStdout(entry, chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => this.handleStderr(entry, chunk.toString("utf8")));
    child.on("error", async (error) => {
      entry.status = { ...entry.status, status: "failed", last_error: error.message, stopped_at: new Date().toISOString() };
      this.rejectPending(entry, error);
      await this.writeState(entry);
    });
    child.on("close", async (code) => {
      if (entry.status.status === "stopped") {
        await this.writeState(entry);
        return;
      }
      entry.status = {
        ...entry.status,
        status: code === 0 ? "exited" : "failed",
        stopped_at: new Date().toISOString(),
        last_error: code === 0 ? null : `process exited with code ${code ?? -1}`
      };
      this.processes.delete(mockId);
      this.rejectPending(entry, new Error(entry.status.last_error ?? "process exited"));
      await this.writeState(entry);
    });

    return { ...status };
  }

  async stop(mockId: string): Promise<MockServerStatus> {
    const entry = this.processes.get(mockId);
    if (!entry) {
      const stopped = await this.readStoredStatus(mockId);
      return { ...stopped, status: "stopped", stopped_at: new Date().toISOString() };
    }
    this.processes.delete(mockId);
    entry.status = {
      ...entry.status,
      status: "stopped",
      stopped_at: new Date().toISOString(),
      stdout_tail: entry.stdoutTail,
      stderr_tail: entry.stderrTail
    };
    this.rejectPending(entry, new Error("process stopped"));
    entry.child.kill("SIGTERM");
    await wait(100);
    if (!entry.child.killed) entry.child.kill("SIGKILL");
    await this.writeState(entry);
    return { ...entry.status };
  }

  async status(mockId: string): Promise<MockServerStatus> {
    const entry = this.processes.get(mockId);
    if (entry) {
      return {
        ...entry.status,
        stdout_tail: entry.stdoutTail,
        stderr_tail: entry.stderrTail
      };
    }
    return await this.readStoredStatus(mockId);
  }

  async sendJsonRpc(mockId: string, method: string, params: unknown, timeoutMs = 5000): Promise<JsonRpcEnvelope & { result?: any }> {
    const entry = this.processes.get(mockId);
    if (!entry) throw new MockLabError(409, "mock server is not running");
    const id = entry.nextId++;
    const request = { jsonrpc: "2.0", id, method, params };
    return await new Promise((resolve, reject) => {
      const key = String(id);
      const timer = setTimeout(() => {
        entry.pending.delete(key);
        reject(new MockLabError(504, `${method} timed out`));
      }, timeoutMs);
      entry.pending.set(key, { resolve, reject, timer });
      entry.child.stdin.write(`${JSON.stringify(request)}\n`, "utf8");
    });
  }

  private handleStdout(entry: ProcessEntry, text: string): void {
    appendTail(entry.stdoutTail, text);
    entry.stdoutBuffer += text;
    let newline = entry.stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = entry.stdoutBuffer.slice(0, newline).trim();
      entry.stdoutBuffer = entry.stdoutBuffer.slice(newline + 1);
      if (line.startsWith("{")) {
        try {
          const parsed = JSON.parse(line) as JsonRpcEnvelope;
          const pending = entry.pending.get(String(parsed.id));
          if (pending) {
            clearTimeout(pending.timer);
            entry.pending.delete(String(parsed.id));
            pending.resolve(parsed);
          }
        } catch {
          // Non-JSON status output is kept in the tail only.
        }
      }
      newline = entry.stdoutBuffer.indexOf("\n");
    }
  }

  private handleStderr(entry: ProcessEntry, text: string): void {
    appendTail(entry.stderrTail, text);
  }

  private rejectPending(entry: ProcessEntry, error: Error): void {
    for (const pending of entry.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    entry.pending.clear();
  }

  private async writeState(entry: ProcessEntry): Promise<void> {
    await writeJsonFile(this.options.store.resolveServerState(entry.mockId), {
      ...entry.status,
      stdout_tail: entry.stdoutTail,
      stderr_tail: entry.stderrTail
    });
  }

  private async readStoredStatus(mockId: string): Promise<MockServerStatus> {
    const statePath = this.options.store.resolveServerState(mockId);
    const text = await readFile(statePath, "utf8").catch(() => "");
    if (text.trim()) {
      try {
        const parsed = JSON.parse(text) as MockServerStatus;
        if (parsed.status === "running" || parsed.status === "starting") {
          return { ...parsed, status: "stopped", pid: null };
        }
        return parsed;
      } catch {
        // Fall through to default status.
      }
    }
    return {
      mock_id: mockId,
      status: "stopped",
      pid: null,
      started_at: null,
      command: null,
      cwd: null,
      stdout_tail: [],
      stderr_tail: []
    };
  }
}

function appendTail(tail: string[], text: string): void {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) tail.push(line.slice(0, 1000));
  }
  while (tail.length > 80) tail.shift();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
