import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MockDraftDetail, MockDraftStatus, MockDraftSummary } from "../src/types/mockSpec";
import { MockLabError, MockSpecStore, readJson, writeJsonFile } from "./mockSpecStore";
import { validateMockSpec } from "./schemaValidation";

const ALLOWED_MODELS = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_DRAFT_TIMEOUT_MS = 10 * 60 * 1000;

export interface MockDraftCommandSpec {
  command: string;
  args: string[];
  displayCommand: string;
}

export type MockDraftCommandBuilder = (input: {
  repoRoot: string;
  mockId: string;
  prompt: string;
  model: string;
  draftSpecPath: string;
}) => MockDraftCommandSpec;

interface ActiveDraft {
  mockId: string;
  draftId: string;
  draftDir: string;
  draftSpecPath: string;
  child: ChildProcess;
  startedAt: Date;
  summary: MockDraftSummary;
  timeout: NodeJS.Timeout | null;
  cancelRequested: boolean;
  timedOut: boolean;
  finalized: boolean;
}

export class MockDraftRegistry {
  private readonly activeByMockId = new Map<string, ActiveDraft>();
  private readonly options: {
    repoRoot: string;
    store: MockSpecStore;
    commandBuilder: MockDraftCommandBuilder;
    timeoutMs: number;
  };

  constructor(options: {
    repoRoot: string;
    store: MockSpecStore;
    commandBuilder?: MockDraftCommandBuilder;
    timeoutMs?: number;
  }) {
    this.options = {
      repoRoot: options.repoRoot,
      store: options.store,
      commandBuilder: options.commandBuilder ?? buildDefaultDraftCommand,
      timeoutMs: options.timeoutMs ?? DEFAULT_DRAFT_TIMEOUT_MS
    };
  }

  async start(input: { mockId: string; prompt: unknown; model?: unknown }): Promise<MockDraftSummary> {
    const active = this.activeByMockId.get(input.mockId);
    if (active && active.summary.status === "running") {
      return { ...active.summary };
    }

    const prompt = normalizePrompt(input.prompt);
    const model = normalizeModel(input.model);
    const draftId = createDraftId();
    const draftDir = this.options.store.resolveDraftDir(input.mockId, draftId);
    const draftSpecPath = this.options.store.resolveDraftSpec(input.mockId, draftId);
    const startedAt = new Date();
    const commandSpec = this.options.commandBuilder({
      repoRoot: this.options.repoRoot,
      mockId: input.mockId,
      prompt,
      model,
      draftSpecPath
    });
    const request = {
      mock_id: input.mockId,
      draft_id: draftId,
      model,
      prompt,
      draft_spec_path: draftSpecPath
    };

    await mkdir(draftDir, { recursive: true });
    await writeJsonFile(join(draftDir, "request.json"), request);
    await appendEvent(draftDir, "started", "Codex MockSpec draft started.");

    const child = spawn(commandSpec.command, commandSpec.args, {
      cwd: this.options.repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const summary: MockDraftSummary = {
      draft_id: draftId,
      mock_id: input.mockId,
      status: "running",
      model,
      started_at: startedAt.toISOString(),
      finished_at: null,
      elapsed_ms: 0,
      pid: child.pid ?? null,
      command: commandSpec.displayCommand,
      validation: {
        ok: false,
        errors: [],
        warnings: []
      },
      last_error: null
    };
    const entry: ActiveDraft = {
      mockId: input.mockId,
      draftId,
      draftDir,
      draftSpecPath,
      child,
      startedAt,
      summary,
      timeout: null,
      cancelRequested: false,
      timedOut: false,
      finalized: false
    };
    this.activeByMockId.set(input.mockId, entry);
    await writeJsonFile(join(draftDir, "result-summary.json"), summary);
    await appendEvent(draftDir, "spawned", `Codex draft process started with pid ${summary.pid ?? "unknown"}.`);

    child.stdout.on("data", (chunk: Buffer) => {
      void appendOutput(draftDir, "codex-stdout.jsonl", chunk.toString("utf8"));
    });
    child.stderr.on("data", (chunk: Buffer) => {
      void appendOutput(draftDir, "codex-stderr.txt", chunk.toString("utf8"));
    });
    child.on("error", (error) => {
      void this.finalize(entry, "failed", error.message);
    });
    child.on("close", (code) => {
      const status = entry.cancelRequested ? "cancelled" : code === 0 ? "completed" : "failed";
      const lastError =
        status === "cancelled"
          ? "draft cancelled"
          : entry.timedOut
            ? `draft timed out after ${this.options.timeoutMs}ms`
            : code === 0
              ? null
              : `codex exec failed with exit ${code ?? -1}`;
      void this.finalize(entry, status, lastError);
    });
    entry.timeout = setTimeout(() => {
      entry.timedOut = true;
      void appendEvent(draftDir, "timeout", `Draft timed out after ${this.options.timeoutMs}ms.`);
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 2000);
    }, this.options.timeoutMs);

    return { ...summary };
  }

  async cancel(mockId: string, draftId: string): Promise<MockDraftSummary> {
    const entry = this.activeByMockId.get(mockId);
    if (!entry || entry.draftId !== draftId || entry.summary.status !== "running") {
      throw new MockLabError(409, "draft run is not active");
    }
    entry.cancelRequested = true;
    entry.summary = await this.writeInterimSummary(entry, "cancelled", "draft cancelled");
    await appendEvent(entry.draftDir, "cancelled", "Draft cancellation requested.");
    entry.child.kill("SIGTERM");
    setTimeout(() => {
      if (!entry.child.killed) entry.child.kill("SIGKILL");
    }, 2000);
    return { ...entry.summary };
  }

  private async finalize(entry: ActiveDraft, status: MockDraftStatus, lastError: string | null): Promise<void> {
    if (entry.finalized) return;
    entry.finalized = true;
    if (entry.timeout) clearTimeout(entry.timeout);
    this.activeByMockId.delete(entry.mockId);

    let finalStatus = status;
    let finalError = lastError;
    const validation = {
      ok: false,
      errors: [] as string[],
      warnings: [] as string[]
    };

    if (status === "completed") {
      try {
        const draftSpec = parseJsonCandidate(await readFile(entry.draftSpecPath, "utf8"));
        const result = validateMockSpec(draftSpec);
        validation.errors = result.errors.map((issue) => `${issue.path}: ${issue.message}`);
        validation.warnings = result.warnings.map((issue) => `${issue.path}: ${issue.message}`);
        if (!result.ok) {
          finalStatus = "failed";
          finalError = `draft MockSpec validation failed: ${validation.errors.join("; ")}`;
          await appendEvent(entry.draftDir, "validation_failed", finalError);
        } else {
          await this.options.store.writeDraftSpec(entry.mockId, entry.draftId, draftSpec);
          validation.ok = true;
          await appendEvent(entry.draftDir, "drafted", "MockSpec draft validated.");
        }
      } catch (error) {
        finalStatus = "failed";
        finalError = error instanceof Error ? error.message : "draft MockSpec validation failed";
        validation.errors.push(finalError);
        await appendEvent(entry.draftDir, "failed", finalError);
      }
    } else if (finalError) {
      validation.errors.push(finalError);
      await appendEvent(entry.draftDir, finalStatus, finalError);
    }

    const finishedAt = new Date();
    entry.summary = {
      ...entry.summary,
      status: finalStatus,
      finished_at: finishedAt.toISOString(),
      elapsed_ms: finishedAt.getTime() - entry.startedAt.getTime(),
      validation,
      last_error: finalError
    };
    await writeJsonFile(join(entry.draftDir, "result-summary.json"), entry.summary);
  }

  private async writeInterimSummary(
    entry: ActiveDraft,
    status: MockDraftStatus,
    lastError: string | null
  ): Promise<MockDraftSummary> {
    const now = new Date();
    const summary: MockDraftSummary = {
      ...entry.summary,
      status,
      finished_at: status === "running" ? null : now.toISOString(),
      elapsed_ms: now.getTime() - entry.startedAt.getTime(),
      validation: {
        ok: false,
        errors: lastError ? [lastError] : [],
        warnings: []
      },
      last_error: lastError
    };
    await writeJsonFile(join(entry.draftDir, "result-summary.json"), summary);
    return summary;
  }
}

export async function readDraftDetail(store: MockSpecStore, mockId: string, draftId: string): Promise<MockDraftDetail> {
  const draftDir = store.resolveDraftDir(mockId, draftId);
  const request = await readJson(join(draftDir, "request.json"));
  const summary = await readJson<MockDraftSummary>(join(draftDir, "result-summary.json"));
  const events = (await readFile(join(draftDir, "events.jsonl"), "utf8").catch(() => ""))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
  const draft_spec = summary.status === "completed" && summary.validation.ok ? await store.readDraftSpec(mockId, draftId).catch(() => null) : null;
  const stdout = await readFile(join(draftDir, "codex-stdout.jsonl"), "utf8").catch(() => "");
  const stderr = await readFile(join(draftDir, "codex-stderr.txt"), "utf8").catch(() => "");
  return { request, summary, events, draft_spec, stdout, stderr };
}

export function createDraftId(now = new Date(), suffix = randomBytes(3).toString("hex")): string {
  const iso = now.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z-draft-${suffix}`;
}

export function buildDraftSpecPrompt(input: { mockId: string; userPrompt: string }): string {
  return [
    "You are drafting an Agent Factory Mock Lab MockSpec.",
    "",
    "Return only one valid MockSpec JSON object. Do not write files or generate a server project.",
    "",
    `Required mock_id: ${input.mockId}`,
    `Required server_name: ${input.mockId}-mcp`,
    "Required protocol: mcp_stdio",
    "Required description: a short string.",
    "Required source object: { prefill_from_catalog: false, catalog_entry_name: null, catalog_file: null }.",
    "",
    "Guardrails must all be true:",
    "- synthetic_only",
    "- no_private_data",
    "- no_private_endpoint",
    "- no_credentials",
    "- no_production_business_logic",
    "",
    "Draft requirements:",
    "- Top-level fields must include mock_id, server_name, protocol, description, source, tools, and guardrails.",
    "- Define one or more MCP tools.",
    "- Every tool must include name, title, description, inputSchema, outputSchema, successResponse, errorScenarios, latencyMs, riskSignals, and auditRequired.",
    "- errorScenarios must be an array. Each item must include name, when, errorCode, and message. Do not use response or status fields inside errorScenarios.",
    "- errorScenarios[].when must be a JSON object that maps input field names to exact trigger values. It must never be a string.",
    "- inputSchema and outputSchema must be JSON Schema objects with type: object, properties, required, and additionalProperties.",
    "- successResponse must validate against outputSchema.",
    "- Keep every response synthetic and local-only.",
    "- Include a visible synthetic marker in text or values where possible.",
    "- Do not include real endpoints, credentials, deployment scripts, or production business logic.",
    "",
    "Use this minimum shape:",
    JSON.stringify(
      {
        mock_id: input.mockId,
        server_name: `${input.mockId}-mcp`,
        protocol: "mcp_stdio",
        description: "Synthetic local MCP mock server.",
        source: {
          prefill_from_catalog: false,
          catalog_entry_name: null,
          catalog_file: null
        },
        tools: [
          {
            name: "example_tool",
            title: "Example tool",
            description: "Synthetic tool description.",
            inputSchema: {
              type: "object",
              properties: {
                request_id: { type: "string" }
              },
              required: ["request_id"],
              additionalProperties: false
            },
            outputSchema: {
              type: "object",
              properties: {
                synthetic: { type: "boolean", const: true },
                source: { type: "string", const: "agent-factory-mock-lab" }
              },
              required: ["synthetic", "source"],
              additionalProperties: false
            },
            successResponse: {
              synthetic: true,
              source: "agent-factory-mock-lab"
            },
            errorScenarios: [
              {
                name: "example_error",
                when: { request_id: "error" },
                errorCode: "SYNTHETIC_ERROR",
                message: "Synthetic error message."
              }
            ],
            latencyMs: 0,
            riskSignals: [],
            auditRequired: true
          }
        ],
        guardrails: {
          synthetic_only: true,
          no_private_data: true,
          no_private_endpoint: true,
          no_credentials: true,
          no_production_business_logic: true
        }
      },
      null,
      2
    ),
    "",
    "User prompt:",
    input.userPrompt
  ].join("\n");
}

function normalizeModel(value: unknown): string {
  return typeof value === "string" && ALLOWED_MODELS.has(value) ? value : DEFAULT_MODEL;
}

function normalizePrompt(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MockLabError(400, "draft prompt is required");
  }
  const prompt = value.trim();
  if (prompt.length > 20_000) throw new MockLabError(400, "draft prompt must be 20000 characters or less");
  return prompt;
}

function buildDefaultDraftCommand(input: {
  repoRoot: string;
  mockId: string;
  prompt: string;
  model: string;
  draftSpecPath: string;
}): MockDraftCommandSpec {
  const prompt = buildDraftSpecPrompt({ mockId: input.mockId, userPrompt: input.prompt });
  return {
    command: "codex",
    args: [
      "exec",
      "--json",
      "--model",
      input.model,
      "--cd",
      input.repoRoot,
      "--output-last-message",
      input.draftSpecPath,
      prompt
    ],
    displayCommand: `codex exec --json --model ${input.model} --cd ${input.repoRoot} --output-last-message ${input.draftSpecPath}`
  };
}

function parseJsonCandidate(value: string): unknown {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Codex is instructed to return JSON only, but keep failed drafts diagnosable
    // if a model wraps the object in a markdown code fence.
  }

  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed) ?? /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
  if (fenced) {
    return JSON.parse(fenced[1].trim());
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("draft output did not contain a JSON object");
}

async function appendEvent(draftDir: string, phase: string, message: string): Promise<void> {
  const event = { phase, message, at: new Date().toISOString() };
  await appendFile(join(draftDir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

async function appendOutput(draftDir: string, filename: string, value: string): Promise<void> {
  await appendFile(join(draftDir, filename), truncate(redactSecrets(value), 200_000), "utf8");
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
