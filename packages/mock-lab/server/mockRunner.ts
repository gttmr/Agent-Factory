import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GeneratedFileInfo } from "../src/types/mockSpec";
import { collectFiles, MockLabError, MockSpecStore, readJson, writeJsonFile } from "./mockSpecStore";

const ALLOWED_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const DEFAULT_MODEL = "gpt-5.5";

export type MockGenerateStatus = "running" | "completed" | "failed" | "cancelled";

export interface MockGenerateSummary {
  run_id: string;
  mock_id: string;
  status: MockGenerateStatus;
  model: string;
  started_at: string;
  finished_at: string | null;
  elapsed_ms: number;
  pid: number | null;
  command: string | null;
  proposed_files: GeneratedFileInfo[];
  validation: {
    ok: boolean;
    errors: string[];
  };
  last_error: string | null;
}

export interface MockRunDetail {
  request: unknown;
  summary: MockGenerateSummary;
  events: unknown[];
  proposed_files: Array<GeneratedFileInfo & { preview: string }>;
  stdout: string;
  stderr: string;
}

export interface MockCommandSpec {
  command: string;
  args: string[];
  displayCommand: string;
}

export type MockCommandBuilder = (input: {
  repoRoot: string;
  specPath: string;
  outputPath: string;
  model: string;
  prompt: string;
}) => MockCommandSpec;

interface ActiveGeneration {
  mockId: string;
  runId: string;
  runDir: string;
  proposedDir: string;
  child: ChildProcess;
  startedAt: Date;
  summary: MockGenerateSummary;
  timeout: NodeJS.Timeout | null;
  cancelRequested: boolean;
  timedOut: boolean;
  finalized: boolean;
}

const DEFAULT_GENERATION_TIMEOUT_MS = 10 * 60 * 1000;

export class MockGenerationRegistry {
  private readonly activeByMockId = new Map<string, ActiveGeneration>();
  private readonly options: {
    repoRoot: string;
    store: MockSpecStore;
    commandBuilder: MockCommandBuilder;
    timeoutMs: number;
  };

  constructor(options: {
    repoRoot: string;
    store: MockSpecStore;
    commandBuilder?: MockCommandBuilder;
    timeoutMs?: number;
  }) {
    this.options = {
      repoRoot: options.repoRoot,
      store: options.store,
      commandBuilder: options.commandBuilder ?? buildDefaultCodexCommand,
      timeoutMs: options.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS
    };
  }

  async start(input: { mockId: string; model?: unknown }): Promise<MockGenerateSummary> {
    const active = this.activeByMockId.get(input.mockId);
    if (active && active.summary.status === "running") {
      return { ...active.summary };
    }

    const model = normalizeModel(input.model);
    const spec = await this.options.store.readSpec(input.mockId);
    const runId = createRunId();
    const runDir = this.options.store.resolveRunDir(input.mockId, runId);
    const proposedDir = this.options.store.resolveRunProposedDir(input.mockId, runId);
    const specPath = join(this.options.store.resolveMockDir(input.mockId), "mock-spec.json");
    const startedAt = new Date();
    const prompt = buildCodexPrompt({ repoRoot: this.options.repoRoot, specPath, outputPath: proposedDir });
    const commandSpec = this.options.commandBuilder({
      repoRoot: this.options.repoRoot,
      specPath,
      outputPath: proposedDir,
      model,
      prompt
    });
    const request = {
      mock_id: input.mockId,
      run_id: runId,
      model,
      spec_path: specPath,
      output_path: proposedDir,
      tool_names: spec.tools.map((tool) => tool.name)
    };

    await mkdir(proposedDir, { recursive: true });
    await writeJsonFile(join(runDir, "request.json"), request);
    await appendEvent(runDir, "started", "Codex mock server generation started.");

    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd: this.options.repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const summary: MockGenerateSummary = {
      run_id: runId,
      mock_id: input.mockId,
      status: "running",
      model,
      started_at: startedAt.toISOString(),
      finished_at: null,
      elapsed_ms: 0,
      pid: child.pid ?? null,
      command: commandSpec.displayCommand,
      proposed_files: [],
      validation: {
        ok: false,
        errors: []
      },
      last_error: null
    };
    const entry: ActiveGeneration = {
      mockId: input.mockId,
      runId,
      runDir,
      proposedDir,
      child,
      startedAt,
      summary,
      timeout: null,
      cancelRequested: false,
      timedOut: false,
      finalized: false
    };
    this.activeByMockId.set(input.mockId, entry);
    await writeJsonFile(join(runDir, "result-summary.json"), summary);
    await appendEvent(runDir, "spawned", `Codex process started with pid ${summary.pid ?? "unknown"}.`);

    child.stdout.on("data", (chunk: Buffer) => {
      void appendOutput(runDir, "codex-stdout.jsonl", chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      void appendOutput(runDir, "codex-stderr.txt", chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      void this.finalize(entry, "failed", error.message);
    });
    child.on("close", (code) => {
      const status = entry.cancelRequested ? "cancelled" : code === 0 ? "completed" : "failed";
      const lastError =
        status === "cancelled"
          ? "generation cancelled"
          : entry.timedOut
            ? `generation timed out after ${this.options.timeoutMs}ms`
            : code === 0
              ? null
              : `codex exec failed with exit ${code ?? -1}`;
      void this.finalize(entry, status, lastError);
    });
    entry.timeout = setTimeout(() => {
      entry.timedOut = true;
      void appendEvent(runDir, "timeout", `Generation timed out after ${this.options.timeoutMs}ms.`);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2000);
    }, this.options.timeoutMs);

    return { ...summary };
  }

  async cancel(mockId: string, runId: string): Promise<MockGenerateSummary> {
    const entry = this.activeByMockId.get(mockId);
    if (!entry || entry.runId !== runId || entry.summary.status !== "running") {
      throw new MockLabError(409, "generation run is not active");
    }
    entry.cancelRequested = true;
    entry.summary = await this.writeInterimSummary(entry, "cancelled", "generation cancelled");
    await appendEvent(entry.runDir, "cancelled", "Generation cancellation requested.");
    entry.child.kill("SIGTERM");
    setTimeout(() => {
      if (!entry.child.killed) entry.child.kill("SIGKILL");
    }, 2000);
    return { ...entry.summary };
  }

  private async finalize(entry: ActiveGeneration, status: MockGenerateStatus, lastError: string | null): Promise<void> {
    if (entry.finalized) return;
    entry.finalized = true;
    if (entry.timeout) clearTimeout(entry.timeout);
    this.activeByMockId.delete(entry.mockId);

    let finalStatus = status;
    let finalError = lastError;
    let proposedFiles = await collectProposedFiles(entry.proposedDir);
    const validationErrors: string[] = [];

    if (status === "completed") {
      try {
        proposedFiles = await this.options.store.validateProposedFiles(entry.mockId, entry.runId);
        await appendEvent(entry.runDir, "proposed", `${proposedFiles.length} proposed file(s) validated.`);
      } catch (error) {
        finalStatus = "failed";
        finalError = error instanceof Error ? error.message : "proposed file validation failed";
        validationErrors.push(finalError);
        await appendEvent(entry.runDir, "failed", finalError);
      }
    } else if (finalError) {
      validationErrors.push(finalError);
      await appendEvent(entry.runDir, finalStatus, finalError);
    }

    const finishedAt = new Date();
    entry.summary = {
      ...entry.summary,
      status: finalStatus,
      finished_at: finishedAt.toISOString(),
      elapsed_ms: finishedAt.getTime() - entry.startedAt.getTime(),
      proposed_files: proposedFiles,
      validation: {
        ok: finalStatus === "completed",
        errors: validationErrors
      },
      last_error: finalError
    };
    await writeJsonFile(join(entry.runDir, "result-summary.json"), entry.summary);
  }

  private async writeInterimSummary(
    entry: ActiveGeneration,
    status: MockGenerateStatus,
    lastError: string | null
  ): Promise<MockGenerateSummary> {
    const now = new Date();
    const summary: MockGenerateSummary = {
      ...entry.summary,
      status,
      finished_at: status === "running" ? null : now.toISOString(),
      elapsed_ms: now.getTime() - entry.startedAt.getTime(),
      proposed_files: await collectProposedFiles(entry.proposedDir),
      validation: {
        ok: false,
        errors: lastError ? [lastError] : []
      },
      last_error: lastError
    };
    await writeJsonFile(join(entry.runDir, "result-summary.json"), summary);
    return summary;
  }
}

export async function runCodexGenerate(input: {
  repoRoot: string;
  store: MockSpecStore;
  mockId: string;
  model?: unknown;
}): Promise<MockGenerateSummary> {
  const registry = new MockGenerationRegistry({ repoRoot: input.repoRoot, store: input.store });
  const started = await registry.start({ mockId: input.mockId, model: input.model });
  return await waitForTerminalSummary(input.store, input.mockId, started.run_id);
}

export async function readRunDetail(store: MockSpecStore, mockId: string, runId: string): Promise<MockRunDetail> {
  const runDir = store.resolveRunDir(mockId, runId);
  const request = await readJson(join(runDir, "request.json"));
  const summary = await readRunSummary(store, mockId, runId);
  const currentFiles = await collectProposedFiles(store.resolveRunProposedDir(mockId, runId));
  const events = (await readFile(join(runDir, "events.jsonl"), "utf8").catch(() => ""))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
  const proposed_files = await Promise.all(
    currentFiles.map(async (file) => ({
      ...file,
      preview: truncate(await readFile(join(store.resolveRunProposedDir(mockId, runId), file.path), "utf8").catch(() => ""), 80_000)
    }))
  );
  const stdout = await readFile(join(runDir, "codex-stdout.jsonl"), "utf8").catch(() => "");
  const stderr = await readFile(join(runDir, "codex-stderr.txt"), "utf8").catch(() => "");
  return { request, summary, events, proposed_files, stdout, stderr };
}

export function createRunId(now = new Date(), suffix = randomBytes(3).toString("hex")): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z-generate-${suffix}`;
}

export function buildCodexPrompt(input: { repoRoot: string; specPath: string; outputPath: string }): string {
  return [
    "You are working in the gttmr/Agent-Factory repository.",
    "",
    "Read AGENTS.md first and preserve all repository guardrails.",
    "",
    "Task:",
    "Generate a local MCP stdio mock server from the approved Mock Lab spec.",
    "",
    "Input:",
    `- Mock spec path: ${input.specPath}`,
    `- Output path: ${input.outputPath}`,
    "",
    "Hard rules:",
    "- Write files only under the proposed-files directory.",
    "- Do not modify catalog/*.yaml.",
    "- Do not modify packages/web.",
    "- Do not add private banking data.",
    "- Do not add real endpoints.",
    "- Do not add credentials.",
    "- Do not add deployment scripts.",
    "- Do not add production business logic.",
    "- Treat every response as synthetic test double output.",
    "- Include a visible synthetic marker in tool results.",
    "- Keep the mock server local-only.",
    "- Keep the stdio process alive with process.stdin.resume() and a keepalive setInterval while stdin is open.",
    "- Clear the keepalive and exit cleanly on both SIGTERM and stdin/readline close so one-shot pipe smokes can terminate.",
    "",
    "Generate:",
    "- package.json",
    "- src/server.ts",
    "- src/mockSpec.ts",
    "- src/schema.ts",
    "- src/audit.ts",
    "- tests/smoke.test.ts",
    "- README.md",
    "",
    "Server requirements:",
    "- Implement MCP tools/list.",
    "- Implement MCP tools/call.",
    "- Expose each tool in mock-spec.tools.",
    "- Validate arguments against inputSchema.",
    "- Validate structuredContent against outputSchema.",
    "- Return structuredContent and text content.",
    "- Support successResponse.",
    "- Support basic errorScenarios.",
    "- Support latencyMs.",
    "- Append audit-log.jsonl for every tools/call.",
    "- Include npm scripts: build, test, start.",
    "- The start script should be local and stdio-safe, for example: node --experimental-strip-types src/server.ts.",
    "",
    "After writing files, return a concise summary:",
    "- generated files",
    "- run commands",
    "- smoke test command",
    "- known limitations"
  ].join("\n");
}

function normalizeModel(value: unknown): string {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? value : DEFAULT_MODEL;
}

function buildDefaultCodexCommand(input: {
  repoRoot: string;
  specPath: string;
  outputPath: string;
  model: string;
  prompt: string;
}): MockCommandSpec {
  return {
    command: "codex",
    args: ["exec", "--json", "--model", input.model, "--cd", input.repoRoot, input.prompt],
    displayCommand: `codex exec --json --model ${input.model} --cd ${input.repoRoot}`
  };
}

async function appendEvent(runDir: string, phase: string, message: string): Promise<void> {
  const event = { phase, message, at: new Date().toISOString() };
  const path = join(runDir, "events.jsonl");
  const existing = await readFile(path, "utf8").catch(() => "");
  await writeFile(path, `${existing}${JSON.stringify(event)}\n`, "utf8");
}

async function appendOutput(runDir: string, filename: string, value: string): Promise<void> {
  await appendFile(join(runDir, filename), truncate(redactSecrets(value), 200_000), "utf8");
}

async function collectProposedFiles(proposedDir: string): Promise<GeneratedFileInfo[]> {
  return await collectFiles(proposedDir, proposedDir).catch(() => []);
}

async function readRunSummary(store: MockSpecStore, mockId: string, runId: string): Promise<MockGenerateSummary> {
  const runDir = store.resolveRunDir(mockId, runId);
  const summary = await readJson<MockGenerateSummary>(join(runDir, "result-summary.json")).catch(() => null);
  if (summary) return summary;
  const request = await readJson<Record<string, any>>(join(runDir, "request.json"));
  return {
    run_id: runId,
    mock_id: mockId,
    status: "failed",
    model: typeof request.model === "string" ? request.model : DEFAULT_MODEL,
    started_at: inferStartedAtFromRunId(runId) ?? new Date(0).toISOString(),
    finished_at: null,
    elapsed_ms: 0,
    pid: null,
    command: null,
    proposed_files: await collectProposedFiles(store.resolveRunProposedDir(mockId, runId)),
    validation: {
      ok: false,
      errors: ["result-summary.json is missing; generation may have been interrupted before status was recorded."]
    },
    last_error: "result-summary.json is missing; generation may have been interrupted before status was recorded."
  };
}

async function waitForTerminalSummary(store: MockSpecStore, mockId: string, runId: string): Promise<MockGenerateSummary> {
  while (true) {
    const summary = await readRunSummary(store, mockId, runId);
    if (summary.status !== "running") return summary;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

function inferStartedAtFromRunId(runId: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z-generate-[a-f0-9]{6}$/.exec(runId);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
}

function redactSecrets(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/(api[_-]?key["':=\s]+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/(token["':=\s]+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;
}
