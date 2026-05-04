import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const allowedModels = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const moduleCategories = new Set(["agent", "workflow", "adapter", "remote_a2a"]);
const adapterKinds = new Set([
  "legacy_api",
  "retrieval",
  "rule_registry",
  "data_query",
  "template",
  "computation",
  "external_service",
  "unknown"
]);
const agentKinds = new Set(["specialist", "shared"]);
const workflowKinds = new Set([
  "sequential",
  "parallel",
  "loop",
  "human_review",
  "orchestration",
  "graph",
  "dynamic",
  "unknown"
]);
const remoteContractKinds = new Set(["a2a", "unknown"]);
const riskLevels = new Set(["low", "medium", "high"]);
const moduleStatuses = new Set(["needs_info", "deferred", "rejected"]);
const requirementStatuses = new Set(["draft", "reviewed", "approved", "rejected"]);
const riskSignals = new Set([
  "personal_data",
  "financial_data",
  "credit_decision_support",
  "customer_impact",
  "external_message",
  "transaction_write",
  "human_approval_required",
  "audit_required"
]);
const systemAccess = new Set(["unknown", "read", "write", "read_write", "not_required"]);
const flowNodeTypes = new Set(["input", "output", "agent", "workflow", "adapter", "remote_a2a"]);
const flowEdgeTypes = new Set(["local", "remote_a2a"]);
const adkHintKeys = new Set(["state_memory", "callbacks", "artifacts_events", "mcp_a2a", "streaming_grounding"]);
const remoteRequiredFields = [
  "owner",
  "agent_card",
  "auth",
  "task_lifecycle",
  "timeout",
  "retry",
  "fallback",
  "audit",
  "data_policy"
];
const codexMcpOverrides = [
  "-c",
  "mcp_servers.stitch.enabled=false",
  "-c",
  "mcp_servers.chrome-devtools.enabled=false",
  "-c",
  "mcp_servers.adk-docs-mcp.enabled=true"
];
const defaultAnalyzerTimeoutMs = 600_000;

type MiddlewareNext = (error?: unknown) => void;
type AnalyzerProgressPhase = "started" | "cli_event" | "diagnostic" | "completed" | "failed" | "timeout";
type AnalyzerTraceKind =
  | "tool_call"
  | "tool_result"
  | "assistant_message"
  | "reasoning_summary"
  | "lifecycle"
  | "diagnostic";
type AnalyzerTraceStatus = "running" | "completed" | "failed" | "timeout" | "info";

interface AnalyzerProgressEvent {
  phase: AnalyzerProgressPhase;
  message: string;
  at: string;
  elapsedMs: number;
  model?: string;
  timeoutMs?: number;
  inputChars?: number;
  promptChars?: number;
  eventCount?: number;
  eventType?: string;
  lastEventType?: string;
  eventTypeCounts?: Record<string, number>;
  traceKind?: AnalyzerTraceKind;
  title?: string;
  snippet?: string;
  snippetFull?: string;
  toolName?: string;
  status?: AnalyzerTraceStatus;
  durationMs?: number;
  rawEventType?: string;
  sequence?: number;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
}

interface AnalyzerDiagnostics {
  elapsedMs: number;
  eventCount: number;
  lastEventType?: string;
  eventTypeCounts: Record<string, number>;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
}

interface ProcessRunResult {
  stdout: string;
  stderr: string;
  diagnostics: AnalyzerDiagnostics;
}

interface CodexAnalyzerRun {
  output: unknown;
  diagnostics: AnalyzerDiagnostics;
  promptChars: number;
  timeoutMs: number;
}

type CodexAnalyzerError = Error & {
  analyzerPhase: "failed" | "timeout";
  analyzerDiagnostics: AnalyzerDiagnostics;
  inputChars?: number;
  promptChars?: number;
  timeoutMs?: number;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
};

export function createCodexAnalyzerMiddleware(repoRoot: string) {
  const schemaPath = resolve(repoRoot, "schemas/analysis-result.schema.json");
  let isAnalyzing = false;

  return async function codexAnalyzerMiddleware(req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "POST 요청만 지원합니다." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const input = isRecord(body) ? body.input : null;
      const model = isRecord(body) ? body.model : null;
      const catalog = isRecord(body) ? sanitizeCatalogPayload(body.catalog) : [];

      if (!isRecord(input) || typeof input.rawText !== "string" || !input.rawText.trim()) {
        sendJson(res, 400, { error: "원문 요구사항이 필요합니다." });
        return;
      }
      if (typeof model !== "string" || !allowedModels.has(model)) {
        sendJson(res, 400, { error: "허용되지 않은 Codex 모델입니다." });
        return;
      }
      const streamProgress = shouldStreamProgress(req, body);
      if (isAnalyzing) {
        sendJson(res, 409, { error: "이미 Codex CLI 분석이 진행 중입니다. 완료 후 다시 실행하세요." });
        return;
      }

      isAnalyzing = true;
      try {
        if (streamProgress) {
          await runStreamingAnalysis({ repoRoot, schemaPath, input, model, catalog, res });
          return;
        }

        const run = await runCodexAnalyzer({ repoRoot, schemaPath, input, model, catalog });
        const result = normalizeAnalysisResult(run.output);
        const errors = validateAnalysisResult(result);
        if (errors.length) {
          console.error("[codex-analyzer] 응답 검증 실패:", errors);
          sendJson(res, 502, { error: `Codex CLI 응답 검증 실패: ${errors.join("; ")}` });
          return;
        }

        logAnalyzerDiagnostics("completed", {
          model,
          inputChars: countInputChars(input),
          promptChars: run.promptChars,
          timeoutMs: run.timeoutMs,
          diagnostics: run.diagnostics
        });
        sendJson(res, 200, result);
      } finally {
        isAnalyzing = false;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "요청 JSON을 해석하지 못했습니다." });
        return;
      }
      console.error("[codex-analyzer] 분석 실패:", error);
      if (error instanceof Error) {
        sendJson(res, 500, { error: error.message });
        return;
      }
      next(error);
    }
  };
}

async function runStreamingAnalysis({
  repoRoot,
  schemaPath,
  input,
  model,
  catalog,
  res
}: {
  repoRoot: string;
  schemaPath: string;
  input: Record<string, unknown>;
  model: string;
  catalog: SanitizedCatalogEntry[];
  res: ServerResponse;
}) {
  const writeProgress = createProgressStream(res);

  try {
    const run = await runCodexAnalyzer({
      repoRoot,
      schemaPath,
      input,
      model,
      catalog,
      onProgress: writeProgress
    });
    const result = normalizeAnalysisResult(run.output);
    const errors = validateAnalysisResult(result);
    if (errors.length) {
      console.error("[codex-analyzer] 응답 검증 실패:", errors);
      writeProgress({
        phase: "failed",
        message: `Codex CLI 응답 검증 실패: ${errors.join("; ")}`,
        at: new Date().toISOString(),
        elapsedMs: run.diagnostics.elapsedMs,
        model,
        timeoutMs: run.timeoutMs,
        eventCount: run.diagnostics.eventCount,
        lastEventType: run.diagnostics.lastEventType,
        eventTypeCounts: run.diagnostics.eventTypeCounts,
        traceKind: "diagnostic",
        title: "검증 실패",
        snippet: run.diagnostics.lastTraceSnippet,
        status: "failed",
        lastTraceTitle: run.diagnostics.lastTraceTitle,
        lastTraceSnippet: run.diagnostics.lastTraceSnippet
      });
      return;
    }

    const completed: AnalyzerProgressEvent & { result: unknown } = {
      phase: "completed",
      message: "Codex CLI 분석이 완료되었습니다.",
      at: new Date().toISOString(),
      elapsedMs: run.diagnostics.elapsedMs,
      model,
      timeoutMs: run.timeoutMs,
      promptChars: run.promptChars,
      inputChars: countInputChars(input),
      eventCount: run.diagnostics.eventCount,
      lastEventType: run.diagnostics.lastEventType,
      eventTypeCounts: run.diagnostics.eventTypeCounts,
      traceKind: "lifecycle",
      title: "분석 완료",
      status: "completed",
      lastTraceTitle: run.diagnostics.lastTraceTitle,
      lastTraceSnippet: run.diagnostics.lastTraceSnippet,
      result
    };
    logAnalyzerDiagnostics("completed", {
      model,
      inputChars: completed.inputChars,
      promptChars: run.promptChars,
      timeoutMs: run.timeoutMs,
      diagnostics: run.diagnostics
    });
    writeProgress(completed);
  } catch (error) {
    const progress = progressFromError(error, model);
    console.error("[codex-analyzer] 분석 실패:", error);
    logAnalyzerDiagnostics(progress.phase, {
      model,
      inputChars: countInputChars(input),
      timeoutMs: progress.timeoutMs,
      promptChars: progress.promptChars,
      diagnostics: {
        elapsedMs: progress.elapsedMs,
        eventCount: progress.eventCount ?? 0,
        lastEventType: progress.lastEventType,
        eventTypeCounts: progress.eventTypeCounts ?? {},
        lastTraceTitle: progress.lastTraceTitle,
        lastTraceSnippet: progress.lastTraceSnippet
      }
    });
    writeProgress(progress);
  } finally {
    res.end();
  }
}

async function runCodexAnalyzer({
  repoRoot,
  schemaPath,
  input,
  model,
  catalog,
  onProgress
}: {
  repoRoot: string;
  schemaPath: string;
  input: Record<string, unknown>;
  model: string;
  catalog: SanitizedCatalogEntry[];
  onProgress?: (event: AnalyzerProgressEvent) => void;
}): Promise<CodexAnalyzerRun> {
  const runDir = join(tmpdir(), `agent-factory-codex-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(runDir, { recursive: true });
  const outputPath = join(runDir, "analysis-result.json");
  const prompt = buildPrompt(input, catalog);
  const timeoutMs = getAnalyzerTimeoutMs();
  const startedAt = Date.now();

  onProgress?.({
    phase: "started",
    message: "Codex CLI 분석을 시작했습니다.",
    at: new Date().toISOString(),
    elapsedMs: 0,
    model,
    timeoutMs,
    inputChars: countInputChars(input),
    promptChars: prompt.length,
    traceKind: "lifecycle",
    title: "분석 시작",
    status: "running"
  });

  try {
    const { stdout, stderr, diagnostics } = await runProcess(
      "codex",
      [
        ...codexMcpOverrides,
        "-m",
        model,
        "--cd",
        repoRoot,
        "exec",
        "--dangerously-bypass-approvals-and-sandbox",
        "--ephemeral",
        "--json",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        outputPath,
        "-"
      ],
      prompt,
      {
        timeoutMs,
        startedAt,
        model,
        onProgress
      }
    );

    const outputText = await readFile(outputPath, "utf8").catch(() => stdout);
    try {
      const output = parseJsonObject(outputText);
      onProgress?.({
        phase: "diagnostic",
        message: "Codex CLI 실행 계측을 수집했습니다.",
        at: new Date().toISOString(),
        elapsedMs: diagnostics.elapsedMs,
        model,
        timeoutMs,
        inputChars: countInputChars(input),
        promptChars: prompt.length,
        eventCount: diagnostics.eventCount,
        lastEventType: diagnostics.lastEventType,
        eventTypeCounts: diagnostics.eventTypeCounts,
        traceKind: "diagnostic",
        title: "실행 계측 수집",
        status: "info",
        lastTraceTitle: diagnostics.lastTraceTitle,
        lastTraceSnippet: diagnostics.lastTraceSnippet
      });
      return {
        output,
        diagnostics,
        promptChars: prompt.length,
        timeoutMs
      };
    } catch {
      throw createAnalyzerError(
        "failed",
        `Codex CLI가 JSON 응답을 반환하지 않았습니다. ${stderr || stdout}`.trim(),
        {
          ...diagnostics,
          timeoutMs
        }
      );
    }
  } catch (error) {
    if (isAnalyzerError(error)) {
      error.inputChars = countInputChars(input);
      error.promptChars = prompt.length;
    }
    throw error;
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

interface SanitizedCatalogEntry {
  id: string;
  name: string;
  module_category: string;
  subtype: string | null;
  access_protocol?: string;
  mcp_server?: string;
  mcp_tool_name?: string;
  owner_domain?: string;
  status?: string;
  responsibility?: string;
  risk_signals?: string[];
}

function sanitizeCatalogPayload(value: unknown): SanitizedCatalogEntry[] {
  if (!Array.isArray(value)) return [];
  const limit = 200;
  const stringField = (record: Record<string, unknown>, key: string, max = 240): string | undefined => {
    const raw = record[key];
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, max);
  };
  const sanitized: SanitizedCatalogEntry[] = [];
  for (const item of value) {
    if (sanitized.length >= limit) break;
    if (!isRecord(item)) continue;
    const name = stringField(item, "name", 120);
    const moduleCategory = stringField(item, "module_category", 32);
    if (!name || !moduleCategory || !moduleCategories.has(moduleCategory)) continue;
    const id = stringField(item, "id", 120) ?? `catalog-${sanitized.length + 1}`;
    const subtypeRaw = stringField(item, "subtype", 48);
    const riskSignalsRaw = item.risk_signals;
    const risk_signals = Array.isArray(riskSignalsRaw)
      ? riskSignalsRaw
          .filter((signal): signal is string => typeof signal === "string" && riskSignals.has(signal))
          .slice(0, 8)
      : undefined;
    sanitized.push({
      id,
      name,
      module_category: moduleCategory,
      subtype: subtypeRaw ?? null,
      access_protocol: stringField(item, "access_protocol", 32),
      mcp_server: stringField(item, "mcp_server", 120),
      mcp_tool_name: stringField(item, "mcp_tool_name", 120),
      owner_domain: stringField(item, "owner_domain", 120),
      status: stringField(item, "status", 80),
      responsibility: stringField(item, "responsibility", 320),
      risk_signals: risk_signals && risk_signals.length ? risk_signals : undefined
    });
  }
  return sanitized;
}

function buildPrompt(input: Record<string, unknown>, catalog: SanitizedCatalogEntry[]): string {
  const sections: string[] = [
    "You are the live requirement analyzer for the Agent Factory workbench.",
    "Return only JSON matching schemas/analysis-result.schema.json. No markdown, no commentary.",
    "",
    "ADK runtime baseline:",
    "- ADK 2.0 (Beta) is the default mental model: graph-based deterministic workflows with explicit nodes/edges, dynamic (Python-driven) workflows, built-in parallel/merge, first-class human-input nodes, and trace/token observability.",
    "- ADK 1.14 stable agents (SequentialAgent / ParallelAgent / LoopAgent) remain valid as a legacy compat fallback when a target deployment cannot run 2.0. Do not invent new top-level categories for either runtime.",
    "",
    "Authoritative references - consult these before deciding:",
    "- docs/workbench/taxonomy.md (module_category, *_kind enums including graph/dynamic, Remote A2A conditions) — read from the working tree.",
    "- docs/workbench/workflow-decision-guide.md (sequential/parallel/loop/human_review/orchestration/graph/dynamic rules; ADK 2.0 baseline with 1.14 compat notes).",
    "- docs/workbench/process-flow.md and docs/visualization/design-system.md (process flow stage, edge, and marker rules).",
    "- adk-docs-mcp — use list_doc_sources/fetch_docs for ADK 2.0 component facts (graph workflow, dynamic workflow, human-input node, trace/token observability) and for the version-neutral component set: Sessions/State/Memory, Callbacks, Artifacts/Events, Apps/Plugins, MCP, A2A, Streaming, Grounding. This is the source of truth for adk_hints; prefer 2.0 sections, fall back to 1.14 only for legacy compat questions.",
    "",
    "Do not paraphrase the docs into long output. Use them only to ground classification, adk_hints, and processFlow shape.",
    "",
    "Output rules (engineering invariants only - non-negotiable):",
    "- normalizedRequirement.id = \"req-001\"; every module source_requirement_id = \"req-001\".",
    "- Number module ids sequentially as mod-001, mod-002, mod-003, ... with no gaps.",
    "- processFlow.requirement_id = \"req-001\".",
    "- Process flow node ids may reference input field names, module ids, or output field names. Edges must refer to existing node ids.",
    "- Module node type must equal module_category. Module node subtype should be the active subtype value or null.",
    "- Edge edge_type must be \"remote_a2a\" iff at least one endpoint is a remote_a2a node; all other edges are local.",
    "- Include branch:, parallel:, or loop: prefixes in edge data only when those structures are supported by the requirement.",
    "- Module status must be one of needs_info, deferred, rejected; never approved.",
    "- Every module candidate must include missing_information as an array of short Korean strings. Use [] only when no candidate-specific detail is missing.",
    "- adk_hints is required on every module candidate. Always emit an object with all five keys (state_memory, callbacks, artifacts_events, mcp_a2a, streaming_grounding); set a key to null when its ADK guidance does not apply, and to a short Korean sentence (grounded in adk-docs-mcp) when it does. Use null for the whole adk_hints object only when no ADK component is relevant at all. Route 2.0 trace/token observability hints into artifacts_events (event/token retention) and callbacks (instrumentation hooks); do not invent new hint keys.",
    "- Do not generate runnable business logic, credentials, private endpoints, deployment scripts, or real banking integration details.",
    "",
    "Taxonomy guardrails:",
    "- Use module_category only from agent, workflow, adapter, remote_a2a.",
    "- Allowed workflow_kind values: sequential, parallel, loop, human_review, orchestration, graph, dynamic, unknown.",
    "- Pick graph when the requirement implies an explicit node/edge orchestration with deterministic routing and built-in merge/parallel (ADK 2.0 graph workflow). Distinguishes from orchestration by the explicit graph topology rather than ad-hoc composition.",
    "- Pick dynamic when control flow is code-driven (Python conditionals/loops/custom logic) rather than declarative — for example, when the dynamic dimension dominates over the declarative graph (ADK 2.0 dynamic workflow).",
    "- For human_review: on ADK 2.0 this maps to the first-class human-input node; on 1.14 it remains a workbench gate concept only. The workbench classification is the same in both cases.",
    "- Retrieval and Rule Registry are adapter_kind values, not top-level categories.",
    "- Remote A2A is high-friction and requires an independently owned remote agent protocol boundary, not just multiple local steps.",
    "- Unknown facts belong in missing_information, contradictions, assumptions, rationale, or status; do not ask follow-up questions.",
    "",
    "Korean prose for human-visible fields; keep engineering terms in English (Agent, Workflow, Adapter, Remote A2A, module_category, adapter_kind, Session/State, placeholder).",
    "Preserve important rawText terms and make rationales specific enough that a reviewer can explain why each module exists."
  ];

  if (catalog.length) {
    sections.push(
      "",
      "Registered shared catalog (already-approved reusable agents/workflows/adapters/remote contracts):",
      "- Treat this list as the source of truth for what already exists in the workbench. Prefer reuse over inventing a new module.",
      "- When a candidate's responsibility, subtype, owner_domain, and access protocol match an existing entry, set the candidate's name to the catalog entry's name verbatim, set reuse_candidate to true, and explain the binding in rationale (mention the catalog entry name and id).",
      "- Adapters with access_protocol \"mcp\" reuse the registered mcp_server / mcp_tool_name; copy them onto the candidate exactly. Do not invent server or tool names.",
      "- For partial matches, still emit a candidate but flag the gap in missing_information (e.g. owner mismatch, narrower scope).",
      "- Do not duplicate a catalog entry as a separate new candidate — collapse it into the matching reuse candidate.",
      "- Never fabricate catalog entries that are not in this list.",
      "Catalog JSON:",
      JSON.stringify(catalog, null, 2)
    );
  } else {
    sections.push(
      "",
      "Registered shared catalog: (empty — no reusable entries are currently registered in this session)."
    );
  }

  sections.push("", "RequirementIntakeInput JSON:", JSON.stringify(input, null, 2));

  return sections.join("\n");
}

function runProcess(
  command: string,
  args: string[],
  input: string,
  {
    timeoutMs,
    startedAt,
    model,
    onProgress
  }: {
    timeoutMs: number;
    startedAt: number;
    model: string;
    onProgress?: (event: AnalyzerProgressEvent) => void;
  }
) {
  return new Promise<ProcessRunResult>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const eventTypeCounts: Record<string, number> = {};
    let stdoutBuffer = "";
    let eventCount = 0;
    let lastEventType: string | undefined;
    let lastTraceTitle: string | undefined;
    let lastTraceSnippet: string | undefined;
    let settled = false;

    const emitCliLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return;
      }
      eventCount += 1;
      const event = summarizeCliEvent(trimmed, eventCount);
      lastEventType = event.rawEventType;
      eventTypeCounts[event.rawEventType] = (eventTypeCounts[event.rawEventType] ?? 0) + 1;
      if (!event.traceKind) {
        return;
      }
      lastTraceTitle = event.title;
      lastTraceSnippet = event.snippet;
      onProgress?.({
        phase: "cli_event",
        message: event.message,
        at: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        model,
        timeoutMs,
        eventCount,
        eventType: event.rawEventType,
        lastEventType,
        eventTypeCounts: { ...eventTypeCounts },
        traceKind: event.traceKind,
        title: event.title,
        snippet: event.snippet,
        snippetFull: event.snippetFull,
        toolName: event.toolName,
        status: event.status,
        durationMs: event.durationMs,
        rawEventType: event.rawEventType,
        sequence: event.sequence,
        lastTraceTitle,
        lastTraceSnippet
      });
    };

    const flushStdoutBuffer = () => {
      const remaining = stdoutBuffer.trim();
      stdoutBuffer = "";
      if (remaining) {
        emitCliLine(remaining);
      }
    };

    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      reject(
        createAnalyzerError(
          "timeout",
          `Codex CLI 분석 시간이 초과되었습니다. 제한 ${formatDuration(timeoutMs)}, 경과 ${formatDuration(
            Date.now() - startedAt
          )}, 마지막 활동 ${lastTraceTitle ?? lastEventType ?? "없음"}.`,
          {
            elapsedMs: Date.now() - startedAt,
            timeoutMs,
            eventCount,
            lastEventType,
            eventTypeCounts: { ...eventTypeCounts },
            lastTraceTitle,
            lastTraceSnippet
          }
        )
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      stdoutBuffer += chunk.toString("utf8");
      let newlineIndex = stdoutBuffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = stdoutBuffer.slice(0, newlineIndex);
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        emitCliLine(line);
        newlineIndex = stdoutBuffer.indexOf("\n");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      flushStdoutBuffer();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      const diagnostics = {
        elapsedMs: Date.now() - startedAt,
        eventCount,
        lastEventType,
        eventTypeCounts: { ...eventTypeCounts },
        lastTraceTitle,
        lastTraceSnippet
      };
      if (code === 0) {
        resolvePromise({ stdout, stderr, diagnostics });
        return;
      }
      reject(
        createAnalyzerError(
          "failed",
          `Codex CLI 분석 실패(code ${code ?? "unknown"}): ${stderr || stdout}`.trim(),
          {
            ...diagnostics,
            timeoutMs
          }
        )
      );
    });

    child.stdin.end(input);
  });
}

interface CliTraceEvent {
  rawEventType: string;
  message: string;
  traceKind?: AnalyzerTraceKind;
  title?: string;
  snippet?: string;
  snippetFull?: string;
  toolName?: string;
  status?: AnalyzerTraceStatus;
  durationMs?: number;
  sequence: number;
}

function summarizeCliEvent(line: string, sequence: number): CliTraceEvent {
  const parsed = parseJsonLine(line);
  const rawEventType = getCliEventType(parsed);
  const trace = normalizeCliTrace(parsed, rawEventType);
  return {
    rawEventType,
    sequence,
    message: trace?.message ?? getCliEventMessage(rawEventType),
    ...trace
  };
}

function parseJsonLine(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function getCliEventType(value: unknown): string {
  if (!isRecord(value)) {
    return "stdout";
  }
  for (const key of ["type", "event", "phase"]) {
    if (typeof value[key] === "string" && value[key]) {
      return value[key];
    }
  }
  return "unknown";
}

function getCliEventMessage(eventType: string): string {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("session") && normalized.includes("start")) return "Codex CLI 세션을 시작했습니다.";
  if (normalized.includes("turn") && normalized.includes("start")) return "분석 턴을 시작했습니다.";
  if (normalized.includes("tool") || normalized.includes("mcp") || normalized.includes("exec")) {
    return "분석에 필요한 도구 이벤트를 처리했습니다.";
  }
  if (normalized.includes("message") || normalized.includes("response")) return "모델 응답 이벤트를 수신했습니다.";
  if (normalized.includes("complete") || normalized.includes("finish")) return "Codex CLI 이벤트가 완료 상태를 보고했습니다.";
  if (eventType === "stdout") return "Codex CLI 텍스트 출력을 수신했습니다.";
  return `Codex CLI 이벤트를 수신했습니다: ${eventType}`;
}

function normalizeCliTrace(
  parsed: unknown,
  rawEventType: string
): Omit<CliTraceEvent, "rawEventType" | "sequence"> | null {
  if (!isRecord(parsed)) {
    const raw = String(parsed ?? "");
    return {
      traceKind: "diagnostic",
      title: "CLI 텍스트 출력",
      snippet: summarizeText(raw),
      snippetFull: summarizeFull(raw),
      message: "Codex CLI 텍스트 출력을 수신했습니다.",
      status: "info"
    };
  }

  const normalizedType = rawEventType.toLowerCase();
  const item = getRecordField(parsed, "item") ?? getRecordField(parsed, "payload") ?? getRecordField(parsed, "data");
  const hasStructuredItem = Boolean(item);
  const candidate = isRecord(item) ? item : parsed;
  const candidateType = getFirstString(candidate, ["type", "kind", "name"]).toLowerCase();

  const toolTrace = normalizeToolTrace(parsed, candidate, normalizedType, candidateType);
  if (toolTrace) {
    return toolTrace;
  }

  const summaryRaw = findReasoningSummaryRaw(parsed);
  if (summaryRaw) {
    return {
      traceKind: "reasoning_summary",
      title: "Reasoning 요약",
      snippet: summarizeText(summaryRaw),
      snippetFull: summarizeFull(summaryRaw),
      message: "Reasoning 요약을 수신했습니다.",
      status: normalizedType.includes("completed") ? "completed" : "info"
    };
  }
  if (normalizedType.includes("reasoning")) {
    return null;
  }

  if (normalizedType.includes("error") || normalizedType.includes("failed")) {
    const errorRaw = getFirstString(parsed, ["message", "error", "details"]);
    return {
      traceKind: "diagnostic",
      title: "CLI 오류",
      snippet: summarizeText(errorRaw),
      snippetFull: summarizeFull(errorRaw),
      message: "Codex CLI 오류 이벤트를 수신했습니다.",
      status: "failed"
    };
  }

  if (!hasStructuredItem && (normalizedType.includes("complete") || normalizedType.includes("finish"))) {
    return {
      traceKind: "lifecycle",
      title: "내부 단계 완료",
      message: "Codex CLI 내부 단계가 완료되었습니다.",
      status: "completed"
    };
  }

  if (!hasStructuredItem && normalizedType.includes("started")) {
    return {
      traceKind: "lifecycle",
      title: "내부 단계 진행 중",
      message: "Codex CLI 내부 단계가 진행 중입니다.",
      status: "running"
    };
  }

  const assistantRaw = findAssistantRaw(parsed);
  if (assistantRaw) {
    return {
      traceKind: "assistant_message",
      title: "모델 메모",
      snippet: summarizeText(assistantRaw),
      snippetFull: summarizeFull(assistantRaw),
      message: "모델 메시지를 수신했습니다.",
      status: normalizedType.includes("completed") ? "completed" : "info"
    };
  }

  return null;
}

function normalizeToolTrace(
  parsed: Record<string, unknown>,
  candidate: Record<string, unknown>,
  normalizedType: string,
  candidateType: string
): Omit<CliTraceEvent, "rawEventType" | "sequence"> | null {
  const looksLikeTool =
    normalizedType.includes("tool") ||
    normalizedType.includes("mcp") ||
    normalizedType.includes("exec") ||
    normalizedType.includes("dynamic_tool_call") ||
    candidateType.includes("tool") ||
    candidateType.includes("function_call") ||
    candidateType.includes("exec");

  if (!looksLikeTool) {
    return null;
  }

  const isResult =
    normalizedType.includes("completed") ||
    normalizedType.includes("result") ||
    normalizedType.includes("output") ||
    candidateType.includes("output") ||
    candidateType.includes("result");
  const toolName = findToolName(parsed) || "tool";
  const snippetSource = isResult ? findToolResultText(parsed) : findToolInputText(parsed);
  const status: AnalyzerTraceStatus = normalizedType.includes("failed")
    ? "failed"
    : isResult
      ? "completed"
      : "running";

  return {
    traceKind: isResult ? "tool_result" : "tool_call",
    title: isResult ? "툴 결과" : "툴 호출",
    snippet: summarizeText(snippetSource),
    snippetFull: summarizeFull(snippetSource),
    toolName,
    message: isResult ? `${toolName} 결과를 수신했습니다.` : `${toolName} 호출을 시작했습니다.`,
    status,
    durationMs: getDurationMs(parsed)
  };
}

function findToolName(value: unknown): string {
  const direct = findFirstStringByKey(value, new Set(["toolName", "tool_name", "name", "command"]));
  if (direct && direct.length <= 80) {
    return direct;
  }
  return "";
}

function findToolInputText(value: unknown): string {
  return (
    stringifyTraceField(value, new Set(["input", "arguments", "args", "params", "parameters", "command", "cmd"])) ||
    stringifyTraceField(value, new Set(["item", "payload", "data"]))
  );
}

function findToolResultText(value: unknown): string {
  return (
    stringifyTraceField(value, new Set(["output", "result", "content", "stdout", "stderr", "error"])) ||
    stringifyTraceField(value, new Set(["item", "payload", "data"]))
  );
}

function findAssistantRaw(value: unknown): string {
  return findFirstStringByKey(value, new Set(["message", "text", "delta", "content"]), (key) => {
    const normalized = key.toLowerCase();
    return !normalized.includes("reasoning") && !normalized.includes("summary");
  });
}

function findReasoningSummaryRaw(value: unknown): string {
  return findFirstStringByKey(value, new Set(["reasoning_summary", "summaryTextDelta", "summary_text_delta"]));
}

function findFirstStringByKey(
  value: unknown,
  keys: Set<string>,
  keyAllowed: (key: string) => boolean = () => true
): string {
  if (typeof value === "string") {
    return "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstStringByKey(item, keys, keyAllowed);
      if (found) return found;
    }
    return "";
  }
  if (!isRecord(value)) {
    return "";
  }
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key) && keyAllowed(key)) {
      if (typeof nested === "string") return nested;
      if (typeof nested === "number" || typeof nested === "boolean") return String(nested);
      if (nested !== null && typeof nested === "object") return stringifyForTrace(nested);
    }
  }
  for (const nested of Object.values(value)) {
    const found = findFirstStringByKey(nested, keys, keyAllowed);
    if (found) return found;
  }
  return "";
}

function stringifyTraceField(value: unknown, keys: Set<string>): string {
  const found = findFirstStringByKey(value, keys);
  return found ? stringifyForTrace(found) : "";
}

function stringifyForTrace(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function summarizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 360);
}

function summarizeFull(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4000) {
    return trimmed;
  }
  return `${trimmed.slice(0, 4000)}\n…(${trimmed.length - 4000} more chars truncated)`;
}

function getRecordField(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const field = value[key];
  return isRecord(field) ? field : null;
}

function getFirstString(value: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (typeof value[key] === "string") {
      return value[key];
    }
  }
  return "";
}

function getDurationMs(value: Record<string, unknown>): number | undefined {
  for (const key of ["durationMs", "duration_ms", "elapsedMs", "elapsed_ms"]) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) {
      return value[key];
    }
  }
  return undefined;
}

function shouldStreamProgress(req: IncomingMessage, body: unknown): boolean {
  const accept = typeof req.headers.accept === "string" ? req.headers.accept : "";
  return accept.includes("text/event-stream") || (isRecord(body) && body.streamProgress === true);
}

function createProgressStream(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  return (event: AnalyzerProgressEvent & { result?: unknown }) => {
    res.write(`event: ${event.phase}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
}

function getAnalyzerTimeoutMs(): number {
  const raw = process.env.CODEX_ANALYZER_TIMEOUT_MS;
  if (!raw) {
    return defaultAnalyzerTimeoutMs;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1_000) {
    return defaultAnalyzerTimeoutMs;
  }
  return Math.floor(value);
}

function countInputChars(input: Record<string, unknown>): number {
  return [
    input.title,
    input.domainHint,
    input.rawText,
    input.requesterTeam,
    input.requesterRole,
    input.knownSystems,
    input.expectedOutput
  ]
    .filter((value): value is string => typeof value === "string")
    .reduce((total, value) => total + value.length, 0);
}

function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms}ms`;
  }
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}분 ${remainingSeconds}초` : `${minutes}분`;
}

function createAnalyzerError(
  phase: "failed" | "timeout",
  message: string,
  diagnostics: AnalyzerDiagnostics & { timeoutMs?: number }
) {
  const error = new Error(message) as CodexAnalyzerError;
  error.analyzerPhase = phase;
  error.analyzerDiagnostics = {
    elapsedMs: diagnostics.elapsedMs,
    eventCount: diagnostics.eventCount,
    lastEventType: diagnostics.lastEventType,
    eventTypeCounts: diagnostics.eventTypeCounts
  };
  error.timeoutMs = diagnostics.timeoutMs;
  error.lastTraceTitle = diagnostics.lastTraceTitle;
  error.lastTraceSnippet = diagnostics.lastTraceSnippet;
  return error;
}

function progressFromError(error: unknown, model: string): AnalyzerProgressEvent {
  if (isAnalyzerError(error)) {
    return {
      phase: error.analyzerPhase,
      message: error.message,
      at: new Date().toISOString(),
      elapsedMs: error.analyzerDiagnostics.elapsedMs,
      model,
      timeoutMs: error.timeoutMs,
      inputChars: error.inputChars,
      promptChars: error.promptChars,
      eventCount: error.analyzerDiagnostics.eventCount,
      lastEventType: error.analyzerDiagnostics.lastEventType,
      eventTypeCounts: error.analyzerDiagnostics.eventTypeCounts,
      traceKind: error.analyzerPhase === "timeout" ? "diagnostic" : "diagnostic",
      title: error.analyzerPhase === "timeout" ? "분석 타임아웃" : "분석 실패",
      snippet: error.lastTraceSnippet,
      status: error.analyzerPhase === "timeout" ? "timeout" : "failed",
      lastTraceTitle: error.lastTraceTitle,
      lastTraceSnippet: error.lastTraceSnippet
    };
  }
  return {
    phase: "failed",
    message: error instanceof Error ? error.message : "Codex CLI 분석을 완료하지 못했습니다.",
    at: new Date().toISOString(),
    elapsedMs: 0,
    model
  };
}

function isAnalyzerError(
  error: unknown
): error is CodexAnalyzerError {
  return (
    error instanceof Error &&
    isRecord(error) &&
    (error.analyzerPhase === "failed" || error.analyzerPhase === "timeout") &&
    isRecord(error.analyzerDiagnostics)
  );
}

function logAnalyzerDiagnostics(
  status: string,
  {
    model,
    inputChars,
    promptChars,
    timeoutMs,
    diagnostics
  }: {
    model: string;
    inputChars?: number;
    promptChars?: number;
    timeoutMs?: number;
    diagnostics: AnalyzerDiagnostics;
  }
) {
  console.info("[codex-analyzer] run diagnostics", {
    status,
    model,
    inputChars,
    promptChars,
    timeoutMs,
    elapsedMs: diagnostics.elapsedMs,
    eventCount: diagnostics.eventCount,
    lastEventType: diagnostics.lastEventType,
    lastTraceTitle: diagnostics.lastTraceTitle,
    eventTypeCounts: diagnostics.eventTypeCounts
  });
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("empty");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("no object");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function validateAnalysisResult(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["응답 최상위 값은 객체여야 합니다."];

  validateNormalizedRequirement(value.normalizedRequirement, errors);
  validateEvidence(value.evidence, errors);
  validateModuleCandidates(value.moduleCandidates, errors);
  validateProcessFlow(value.processFlow, errors);

  return errors;
}

function validateNormalizedRequirement(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("normalizedRequirement 객체가 필요합니다.");
    return;
  }
  expectString(value, "id", errors);
  if (typeof value.id === "string" && !/^req-[a-z0-9-]+$/.test(value.id)) {
    errors.push("normalizedRequirement.id는 req-* 패턴이어야 합니다.");
  }
  expectString(value, "title", errors);
  expectString(value, "raw_text", errors);
  expectString(value, "domain", errors);
  if (!isRecord(value.requester)) {
    errors.push("normalizedRequirement.requester 객체가 필요합니다.");
  } else {
    expectString(value.requester, "team", errors);
    expectString(value.requester, "role", errors);
  }
  expectString(value, "business_goal", errors);
  expectStringArray(value.current_process, "normalizedRequirement.current_process", errors);
  validateFields(value.inputs, "normalizedRequirement.inputs", errors);
  validateFields(value.outputs, "normalizedRequirement.outputs", errors);
  validateSystems(value.systems, errors);
  validateRiskSignals(value.risk_signals, "normalizedRequirement.risk_signals", errors);
  expectStringArray(value.missing_information, "normalizedRequirement.missing_information", errors);
  expectStringArray(value.contradictions, "normalizedRequirement.contradictions", errors);
  if (typeof value.status !== "string" || !requirementStatuses.has(value.status)) {
    errors.push("normalizedRequirement.status 값이 올바르지 않습니다.");
  }
}

function validateEvidence(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("evidence 객체가 필요합니다.");
    return;
  }
  [
    "requested_goal",
    "business_domain_hint",
    "user_role",
    "input_data",
    "output_data",
    "systems_mentioned",
    "decisions_implied",
    "risk_signals",
    "missing_information",
    "contradictions",
    "assumptions"
  ].forEach((key) => {
    if (key === "risk_signals") validateRiskSignals(value[key], `evidence.${key}`, errors);
    else if (key.endsWith("_goal") || key.endsWith("_hint") || key === "user_role") expectString(value, key, errors);
    else expectStringArray(value[key], `evidence.${key}`, errors);
  });
}

function validateModuleCandidates(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("moduleCandidates 배열이 필요합니다.");
    return;
  }
  value.forEach((candidate, index) => {
    const label = `moduleCandidates[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${label} 객체가 필요합니다.`);
      return;
    }
    expectString(candidate, "id", errors);
    expectString(candidate, "source_requirement_id", errors);
    if (typeof candidate.id === "string" && !/^mod-[a-z0-9-]+$/.test(candidate.id)) {
      errors.push(`${label}.id는 mod-* 패턴이어야 합니다.`);
    }
    if (
      typeof candidate.source_requirement_id === "string" &&
      !/^req-[a-z0-9-]+$/.test(candidate.source_requirement_id)
    ) {
      errors.push(`${label}.source_requirement_id는 req-* 패턴이어야 합니다.`);
    }
    expectString(candidate, "name", errors);
    expectString(candidate, "rationale", errors);
    validateFields(candidate.inputs, `${label}.inputs`, errors);
    validateFields(candidate.outputs, `${label}.outputs`, errors);
    validateRiskSignals(candidate.risk_signals, `${label}.risk_signals`, errors);
    expectStringArray(candidate.missing_information, `${label}.missing_information`, errors);
    validateAdkHints(candidate.adk_hints, `${label}.adk_hints`, errors);

    if (typeof candidate.module_category !== "string" || !moduleCategories.has(candidate.module_category)) {
      errors.push(`${label}.module_category 값이 올바르지 않습니다.`);
      return;
    }
    if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) {
      errors.push(`${label}.confidence 값은 0 이상 1 이하 숫자여야 합니다.`);
    }
    if (typeof candidate.reuse_candidate !== "boolean") {
      errors.push(`${label}.reuse_candidate 값은 boolean이어야 합니다.`);
    }
    if (typeof candidate.risk_level !== "string" || !riskLevels.has(candidate.risk_level)) {
      errors.push(`${label}.risk_level 값이 올바르지 않습니다.`);
    }
    if (typeof candidate.status !== "string" || !moduleStatuses.has(candidate.status)) {
      errors.push(`${label}.status는 live analyzer에서 approved일 수 없습니다.`);
    }

    if (candidate.module_category === "adapter" && !adapterKinds.has(String(candidate.adapter_kind))) {
      errors.push(`${label} adapter에는 adapter_kind가 필요합니다.`);
    }
    if (candidate.module_category === "agent" && !agentKinds.has(String(candidate.agent_kind))) {
      errors.push(`${label} agent에는 agent_kind가 필요합니다.`);
    }
    if (candidate.module_category === "workflow" && !workflowKinds.has(String(candidate.workflow_kind))) {
      errors.push(`${label} workflow에는 workflow_kind가 필요합니다.`);
    }
    if (candidate.module_category === "remote_a2a") {
      if (!remoteContractKinds.has(String(candidate.remote_contract_kind))) {
        errors.push(`${label} remote_a2a에는 remote_contract_kind가 필요합니다.`);
      }
      if (candidate.risk_level !== "high") {
        errors.push(`${label} remote_a2a는 high risk여야 합니다.`);
      }
      const missing = remoteRequiredFields.filter((field) => !truthyString(candidate[field]));
      if (missing.length) {
        errors.push(`${label} remote_a2a 계약 필드 누락: ${missing.join(", ")}`);
      }
    }
  });
}

function validateAdkHints(value: unknown, label: string, errors: string[]) {
  if (value === undefined || value === null) {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${label} 객체 또는 null이어야 합니다.`);
    return;
  }
  Object.entries(value).forEach(([key, hint]) => {
    if (!adkHintKeys.has(key)) {
      errors.push(`${label}.${key}는 허용되지 않은 adk_hints 키입니다.`);
      return;
    }
    if (hint === null) {
      return;
    }
    if (!truthyString(hint)) {
      errors.push(`${label}.${key} 값은 비어 있지 않은 문자열 또는 null이어야 합니다.`);
    }
  });
}

function validateProcessFlow(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("processFlow 객체가 필요합니다.");
    return;
  }
  expectString(value, "requirement_id", errors);
  if (typeof value.requirement_id === "string" && !/^req-[a-z0-9-]+$/.test(value.requirement_id)) {
    errors.push("processFlow.requirement_id는 req-* 패턴이어야 합니다.");
  }
  if (!Array.isArray(value.nodes)) {
    errors.push("processFlow.nodes 배열이 필요합니다.");
  } else {
    value.nodes.forEach((node, index) => {
      if (!isRecord(node)) {
        errors.push(`processFlow.nodes[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(node, "id", errors);
      expectString(node, "label", errors);
      if (typeof node.type !== "string" || !flowNodeTypes.has(node.type)) {
        errors.push(`processFlow.nodes[${index}].type 값이 올바르지 않습니다.`);
      }
    });
  }
  if (!Array.isArray(value.edges)) {
    errors.push("processFlow.edges 배열이 필요합니다.");
  } else {
    value.edges.forEach((edge, index) => {
      if (!isRecord(edge)) {
        errors.push(`processFlow.edges[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(edge, "from", errors);
      expectString(edge, "to", errors);
      expectString(edge, "data", errors);
      if (typeof edge.edge_type !== "string" || !flowEdgeTypes.has(edge.edge_type)) {
        errors.push(`processFlow.edges[${index}].edge_type 값이 올바르지 않습니다.`);
      }
    });
  }
}

function validateFields(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 배열이 필요합니다.`);
    return;
  }
  value.forEach((field, index) => {
    if (!isRecord(field)) {
      errors.push(`${label}[${index}] 객체가 필요합니다.`);
      return;
    }
    expectString(field, "name", errors);
    expectString(field, "type", errors);
  });
}

function validateSystems(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("normalizedRequirement.systems 배열이 필요합니다.");
    return;
  }
  value.forEach((system, index) => {
    if (!isRecord(system)) {
      errors.push(`normalizedRequirement.systems[${index}] 객체가 필요합니다.`);
      return;
    }
    expectString(system, "name", errors);
    if (typeof system.access !== "string" || !systemAccess.has(system.access)) {
      errors.push(`normalizedRequirement.systems[${index}].access 값이 올바르지 않습니다.`);
    }
  });
}

function validateRiskSignals(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 배열이 필요합니다.`);
    return;
  }
  value.forEach((signal) => {
    if (typeof signal !== "string" || !riskSignals.has(signal)) {
      errors.push(`${label}에 알 수 없는 risk signal이 있습니다.`);
    }
  });
}

function expectString(record: Record<string, unknown>, key: string, errors: string[]) {
  if (typeof record[key] !== "string" || !record[key]) {
    errors.push(`${key} 문자열 값이 필요합니다.`);
  }
}

function expectStringArray(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} 문자열 배열이 필요합니다.`);
  }
}

function truthyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAnalysisResult(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const normalized = { ...value };
  if (Array.isArray(normalized.moduleCandidates)) {
    normalized.moduleCandidates = normalized.moduleCandidates.map((candidate) =>
      isRecord(candidate) ? normalizeCandidate(candidate) : candidate
    );
  }
  if (isRecord(normalized.processFlow) && Array.isArray(normalized.processFlow.nodes)) {
    normalized.processFlow = {
      ...normalized.processFlow,
      nodes: normalized.processFlow.nodes.map((node) => (isRecord(node) ? omitNullProperties(node) : node))
    };
  }
  return normalized;
}

function normalizeCandidate(candidate: Record<string, unknown>): Record<string, unknown> {
  const cleaned = omitNullProperties(candidate);
  const hints = candidate.adk_hints;
  if (isRecord(hints)) {
    const compactHints = omitNullProperties(hints);
    if (Object.keys(compactHints).length > 0) {
      cleaned.adk_hints = compactHints;
    }
  }
  return cleaned;
}

function omitNullProperties(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("요청 본문이 너무 큽니다."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) {
        resolvePromise({});
        return;
      }
      try {
        resolvePromise(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
