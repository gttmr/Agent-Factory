import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { assetTypes, bindingKinds, domainScopes, reuseStatuses, transportKinds } from "../src/analyzer/types";
import { SdkCodexAnalyzerRunner } from "./codexAnalyzerSdkRunner";
import { createAnalyzerError, isAnalyzerError, progressFromError, summarizeProcessFailure } from "./codexAnalyzerRunner";
import type { AnalyzerDiagnostics, AnalyzerProgressEvent, CodexAnalyzerRunner } from "./codexAnalyzerRunner";
import { validateAnalysisResult } from "./analysisResultValidation";
import { isRecord, readJsonBody, sendJson } from "./httpApi";

const allowedModels = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const allowedAssetTypes = new Set<string>(assetTypes);
const allowedDomainScopes = new Set<string>(domainScopes);
const allowedReuseStatuses = new Set<string>(reuseStatuses);
const allowedBindingKinds = new Set<string>(bindingKinds);
const allowedTransports = new Set<string>(transportKinds);
const defaultAnalyzerTimeoutMs = 600_000;

type MiddlewareNext = (error?: unknown) => void;

interface CodexAnalyzerRun {
  output: unknown;
  diagnostics: AnalyzerDiagnostics;
  promptChars: number;
  timeoutMs: number;
}

interface SanitizedCatalogEntry {
  asset_id: string;
  name: string;
  asset_type: string;
  domain_scope: string;
  business_domains: string[];
  owner: string;
  reuse_status: string;
  capability_tags: string[];
  binding: Record<string, unknown> | null;
  connection: { transport: string } | null;
}

export { SdkCodexAnalyzerRunner };
export type { CodexAnalyzerRunner };

export function createCodexAnalyzerMiddleware(repoRoot: string) {
  const schemaPath = resolve(repoRoot, "schemas/analysis-result.schema.json");
  const draftSchemaPath = resolve(repoRoot, "schemas/analysis-draft.schema.json");
  let isAnalyzing = false;

  return async function codexAnalyzerMiddleware(req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "POST 요청만 지원합니다." });
      return;
    }
    try {
      const body = await readJsonBody(req, {
        maxBytes: 1_000_000,
        sizeLimitMessage: "요청 본문이 너무 큽니다.",
        treatWhitespaceAsEmpty: false
      });
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
      if (isAnalyzing) {
        sendJson(res, 409, { error: "이미 Codex SDK 분석이 진행 중입니다. 완료 후 다시 실행하세요." });
        return;
      }

      isAnalyzing = true;
      try {
        if (shouldStreamProgress(req, body)) {
          await runStreamingAnalysis({ repoRoot, schemaPath, draftSchemaPath, input, model, catalog, res });
          return;
        }
        const run = await runCodexAnalyzer({ repoRoot, schemaPath, draftSchemaPath, input, model, catalog });
        const errors = validateAnalysisResult(run.output);
        if (errors.length) {
          sendJson(res, 502, { error: `Codex SDK 응답 검증 실패: ${errors.join("; ")}` });
          return;
        }
        logAnalyzerDiagnostics("completed", model, input, run);
        sendJson(res, 200, run.output);
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
  draftSchemaPath,
  input,
  model,
  catalog,
  res
}: {
  repoRoot: string;
  schemaPath: string;
  draftSchemaPath: string;
  input: Record<string, unknown>;
  model: string;
  catalog: SanitizedCatalogEntry[];
  res: ServerResponse;
}) {
  const writeProgress = createProgressStream(res);
  try {
    const run = await runCodexAnalyzer({ repoRoot, schemaPath, draftSchemaPath, input, model, catalog, onProgress: writeProgress });
    const errors = validateAnalysisResult(run.output);
    if (errors.length) {
      writeProgress({
        phase: "failed",
        message: `Codex SDK 응답 검증 실패: ${errors.join("; ")}`,
        at: new Date().toISOString(),
        elapsedMs: run.diagnostics.elapsedMs,
        model,
        timeoutMs: run.timeoutMs,
        traceKind: "diagnostic",
        title: "검증 실패",
        status: "failed"
      });
      return;
    }
    logAnalyzerDiagnostics("completed", model, input, run);
    writeProgress({
      phase: "completed",
      message: "Codex SDK 분석이 완료되었습니다.",
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
      result: run.output
    });
  } catch (error) {
    const progress = progressFromError(error, model);
    console.error("[codex-analyzer] 분석 실패:", error);
    writeProgress(progress);
  } finally {
    res.end();
  }
}

export async function runCodexAnalyzer({
  repoRoot,
  schemaPath,
  draftSchemaPath,
  input,
  model,
  catalog,
  onProgress,
  codexRunner
}: {
  repoRoot: string;
  schemaPath: string;
  draftSchemaPath: string;
  input: Record<string, unknown>;
  model: string;
  catalog: SanitizedCatalogEntry[];
  onProgress?: (event: AnalyzerProgressEvent) => void;
  codexRunner?: CodexAnalyzerRunner;
}): Promise<CodexAnalyzerRun> {
  const runDir = join(tmpdir(), `agent-factory-codex-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(runDir, { recursive: true });
  const contextIndexPath = join(runDir, "analyzer-context-index.md");
  await writeAnalyzerContextIndex({ repoRoot, schemaPath, catalog, contextIndexPath });
  const prompt = buildPrompt(input, catalog, contextIndexPath);
  const outputSchema = await loadBundledSchema(draftSchemaPath);
  const timeoutMs = getAnalyzerTimeoutMs();
  const startedAt = Date.now();

  onProgress?.({
    phase: "started",
    message: "Codex SDK 분석을 시작했습니다.",
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
    const { outputText, stdout, stderr, diagnostics } = await (codexRunner ?? new SdkCodexAnalyzerRunner()).run({
      repoRoot,
      model,
      prompt,
      outputSchema,
      timeoutMs,
      startedAt,
      onProgress
    });
    try {
      const output = parseJsonObject(outputText);
      const errors = validateAnalysisResult(output);
      if (errors.length) throw new Error(errors.join("; "));
      return { output, diagnostics, promptChars: prompt.length, timeoutMs };
    } catch (parseError) {
      const failure = summarizeProcessFailure(stdout, stderr);
      throw createAnalyzerError(
        "failed",
        `Codex SDK Target v2 응답을 해석하지 못했습니다. ${parseError instanceof Error ? parseError.message : "unknown parse error"}${failure.message ? ` ${failure.message}` : ""}`.trim(),
        { ...diagnostics, timeoutMs, lastTraceSnippet: failure.snippet || diagnostics.lastTraceSnippet }
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

async function loadBundledSchema(schemaPath: string): Promise<Record<string, unknown>> {
  const documentCache = new Map<string, Record<string, unknown>>();
  const readDocument = async (path: string) => {
    const absolute = resolve(path);
    const cached = documentCache.get(absolute);
    if (cached) return cached;
    const parsed: unknown = JSON.parse(await readFile(absolute, "utf8"));
    if (!isRecord(parsed)) throw new Error(`Schema root must be an object: ${absolute}`);
    documentCache.set(absolute, parsed);
    return parsed;
  };
  const root = await readDocument(schemaPath);

  const expand = async (value: unknown, document: Record<string, unknown>, documentPath: string): Promise<unknown> => {
    if (Array.isArray(value)) return Promise.all(value.map((item) => expand(item, document, documentPath)));
    if (!isRecord(value)) return value;
    if (typeof value.$ref === "string") {
      const [filePart, fragment = ""] = value.$ref.split("#", 2);
      const targetPath = filePart ? resolve(dirname(documentPath), filePart) : documentPath;
      const targetDocument = filePart ? await readDocument(targetPath) : document;
      const target = resolveJsonPointer(targetDocument, fragment);
      const expanded = await expand(target, targetDocument, targetPath);
      const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "$ref"));
      if (!Object.keys(siblings).length) return expanded;
      return { ...(isRecord(expanded) ? expanded : {}), ...(await expand(siblings, document, documentPath) as Record<string, unknown>) };
    }
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) result[key] = await expand(child, document, documentPath);
    return result;
  };

  const bundled = await expand(root, root, resolve(schemaPath));
  if (!isRecord(bundled)) throw new Error("Bundled output schema must be an object");
  return bundled;
}

function resolveJsonPointer(document: Record<string, unknown>, fragment: string): unknown {
  if (!fragment) return document;
  if (!fragment.startsWith("/")) throw new Error(`Unsupported schema fragment #${fragment}`);
  return fragment.slice(1).split("/").reduce<unknown>((current, token) => {
    if (!isRecord(current)) throw new Error(`Invalid schema pointer #${fragment}`);
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    return current[key];
  }, document);
}

async function writeAnalyzerContextIndex({
  repoRoot,
  schemaPath,
  catalog,
  contextIndexPath
}: {
  repoRoot: string;
  schemaPath: string;
  catalog: SanitizedCatalogEntry[];
  contextIndexPath: string;
}) {
  const files = [
    "docs/workbench/taxonomy.md",
    "docs/workbench/workflow-decision-guide.md",
    "docs/workbench/graph-ir.md",
    "docs/workbench/analysis-guide.md",
    "schemas/analysis-result.schema.json",
    "schemas/asset-candidate.schema.json",
    "schemas/graph.schema.json",
    "catalog/tools.yaml",
    "catalog/agents.yaml",
    "catalog/workflows.yaml"
  ];
  const summaries: string[] = [];
  for (const file of files) {
    const text = await readFile(resolve(repoRoot, file), "utf8").catch(() => "");
    summaries.push(`- ${file} (${text.length} chars)`);
  }
  await writeFile(
    contextIndexPath,
    [
      "# Agent Factory Analyzer Context Index",
      "",
      "This index points to the strict Target v2 sources; it is not a compatibility map.",
      `- Result schema: ${schemaPath}`,
      "",
      "## Source Files",
      ...summaries,
      "",
      "## Target Catalog Snapshot",
      JSON.stringify(catalog, null, 2)
    ].join("\n"),
    "utf8"
  );
}

function sanitizeCatalogPayload(value: unknown): SanitizedCatalogEntry[] {
  if (!Array.isArray(value)) return [];
  const result: SanitizedCatalogEntry[] = [];
  for (const item of value) {
    if (result.length >= 200 || !isRecord(item)) break;
    if (!stringIn(item.asset_type, allowedAssetTypes) || !truthyString(item.asset_id) || !truthyString(item.name)) continue;
    if (!stringIn(item.domain_scope, allowedDomainScopes) || !stringIn(item.reuse_status, allowedReuseStatuses)) continue;
    if (item.binding !== null && (!isRecord(item.binding) || !stringIn(item.binding.kind, allowedBindingKinds))) continue;
    if (item.connection !== null && (!isRecord(item.connection) || !stringIn(item.connection.transport, allowedTransports))) continue;
    if ((item.binding === null) !== (item.connection === null)) continue;
    result.push({
      asset_id: item.asset_id,
      name: item.name,
      asset_type: item.asset_type,
      domain_scope: item.domain_scope,
      business_domains: sanitizeStringList(item.business_domains, 16, 120),
      owner: truthyString(item.owner) ? item.owner : "unresolved",
      reuse_status: item.reuse_status,
      capability_tags: sanitizeStringList(item.capability_tags, 16, 80),
      binding: isRecord(item.binding) ? { ...item.binding } : null,
      connection: isRecord(item.connection) && typeof item.connection.transport === "string" ? { transport: item.connection.transport } : null
    });
  }
  return result;
}

function buildPrompt(input: Record<string, unknown>, catalog: SanitizedCatalogEntry[], contextIndexPath: string): string {
  return [
    "You are the live requirement analyzer for the Agent Factory workbench. Human-visible prose must be Korean-first.",
    "Return only a strict Target Contract v2 JSON object matching schemas/analysis-result.schema.json.",
    "contract_version must be exactly \"2.0\". Do not omit or add fields.",
    "Use only assetCandidates and graph. Never emit moduleCandidates, processFlow, module_id, module_category, retired subtype/access/runtime projections, graph lanes, layout containers, or validation projections.",
    "Asset types are only agent, workflow, and tool. A2A is only an Agent binding/exposure protocol and A2A contracts use agent_ref.",
    "Graph node kinds are only input, agent, tool, function, human_input, subworkflow, join, output.",
    "Represent routing, loops, callbacks, resume, retry, fallback, error, cancel, and timeout with edge.control; use graph.regions only for parallel and loop regions.",
    `Read ${contextIndexPath} and the linked source files when exact contract decisions matter.`,
    "",
    "Target catalog snapshot:",
    JSON.stringify(catalog, null, 2),
    "",
    "RequirementIntakeInput JSON:",
    JSON.stringify(input, null, 2)
  ].join("\n");
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
  const value = Number(process.env.CODEX_ANALYZER_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 1_000 ? Math.floor(value) : defaultAnalyzerTimeoutMs;
}

function countInputChars(input: Record<string, unknown>): number {
  return [input.domain, input.rawText].filter((value): value is string => typeof value === "string").reduce((total, value) => total + value.length, 0);
}

function logAnalyzerDiagnostics(status: string, model: string, input: Record<string, unknown>, run: CodexAnalyzerRun) {
  console.info("[codex-analyzer] run diagnostics", {
    status,
    model,
    inputChars: countInputChars(input),
    promptChars: run.promptChars,
    timeoutMs: run.timeoutMs,
    elapsedMs: run.diagnostics.elapsedMs,
    eventCount: run.diagnostics.eventCount,
    lastEventType: run.diagnostics.lastEventType,
    eventTypeCounts: run.diagnostics.eventTypeCounts
  });
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("empty response");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("response does not contain a JSON object");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function sanitizeStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems);
}

function stringIn(value: unknown, allowed: ReadonlySet<string>): value is string {
  return typeof value === "string" && allowed.has(value);
}

function truthyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
