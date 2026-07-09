import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  adapterKinds as analyzerAdapterKinds,
  agentKinds as analyzerAgentKinds,
  AGENT_EXECUTION_MODES,
  GRAPH_CONTAINER_KINDS,
  GRAPH_EDGE_KINDS,
  GRAPH_EXECUTION_SEMANTICS,
  GRAPH_LANE_IDS,
  GRAPH_LAYOUT_POLICIES,
  GRAPH_NODE_KINDS,
  moduleCategories as analyzerModuleCategories,
  remoteContractKinds as analyzerRemoteContractKinds,
  riskSignals as analyzerRiskSignals,
  workflowKinds as analyzerWorkflowKinds
} from "../src/analyzer/types";
import { normalizeA2A } from "../src/analyzer/a2aNormalize";
import type { A2ANormalizationDiagnostic } from "../src/analyzer/a2aNormalize";
import type { AnalysisResult } from "../src/analyzer/types";
import { mergeGraphIRValidation, normalizeGraphIRForRuntime, validateGraphIRSoft } from "../src/analyzer/graphMigration";
import { ensureRuntimeContracts } from "../src/analyzer/runtimeContracts";
import { SdkCodexAnalyzerRunner } from "./codexAnalyzerSdkRunner";
import { createAnalyzerError, isAnalyzerError, progressFromError, summarizeProcessFailure } from "./codexAnalyzerRunner";
import type { AnalyzerDiagnostics, AnalyzerProgressEvent, CodexAnalyzerRunner } from "./codexAnalyzerRunner";

const allowedModels = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const moduleCategories: ReadonlySet<string> = new Set(analyzerModuleCategories);
const adapterKinds: ReadonlySet<string> = new Set(analyzerAdapterKinds);
const agentKinds: ReadonlySet<string> = new Set(analyzerAgentKinds);
const workflowKinds: ReadonlySet<string> = new Set(analyzerWorkflowKinds);
const remoteContractKinds: ReadonlySet<string> = new Set(analyzerRemoteContractKinds);
const runtimeContractKinds = new Set([
  "mcp_legacy_adapter",
  "eai_legacy_adapter",
  "context_manager",
  "callback_broker",
  "adk_callback",
  "async_resume"
]);
const runtimeContractStatuses = new Set(["draft", "needs_info", "approved", "rejected"]);
const riskLevels = new Set(["low", "medium", "high"]);
const moduleStatuses = new Set(["needs_info", "approved", "deferred", "rejected"]);
const requirementStatuses = new Set(["draft", "reviewed", "approved", "rejected"]);
const riskSignals: ReadonlySet<string> = new Set(analyzerRiskSignals);
const systemAccess = new Set(["unknown", "read", "write", "read_write", "not_required"]);
const graphNodeKinds: ReadonlySet<string> = new Set(GRAPH_NODE_KINDS);
const graphContainerKinds: ReadonlySet<string> = new Set(GRAPH_CONTAINER_KINDS);
const graphEdgeKinds: ReadonlySet<string> = new Set(GRAPH_EDGE_KINDS);
const graphLaneIds: ReadonlySet<string> = new Set(GRAPH_LANE_IDS);
const graphLayoutPolicies: ReadonlySet<string> = new Set(GRAPH_LAYOUT_POLICIES);
const graphExecutionSemantics: ReadonlySet<string> = new Set(GRAPH_EXECUTION_SEMANTICS);
const agentExecutionModes: ReadonlySet<string> = new Set(AGENT_EXECUTION_MODES);
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
const defaultAnalyzerTimeoutMs = 600_000;

type MiddlewareNext = (error?: unknown) => void;

interface CodexAnalyzerRun {
  output: unknown;
  diagnostics: AnalyzerDiagnostics;
  promptChars: number;
  timeoutMs: number;
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
        sendJson(res, 409, { error: "이미 Codex SDK 분석이 진행 중입니다. 완료 후 다시 실행하세요." });
        return;
      }

      isAnalyzing = true;
      try {
        if (streamProgress) {
          await runStreamingAnalysis({ repoRoot, schemaPath, draftSchemaPath, input, model, catalog, res });
          return;
        }

        const run = await runCodexAnalyzer({ repoRoot, schemaPath, draftSchemaPath, input, model, catalog });
        const baseline = applyGraphIRMigration(normalizeAnalysisResult(run.output));
        const result = applyA2ANormalization(baseline, {
          model,
          timeoutMs: run.timeoutMs,
          elapsedMs: run.diagnostics.elapsedMs
        });
        const errors = validateAnalysisResult(result);
        if (errors.length) {
          console.error("[codex-analyzer] 응답 검증 실패:", errors);
          sendJson(res, 502, { error: `Codex SDK 응답 검증 실패: ${errors.join("; ")}` });
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
    const run = await runCodexAnalyzer({
      repoRoot,
      schemaPath,
      draftSchemaPath,
      input,
      model,
      catalog,
      onProgress: writeProgress
    });
    const baseline = applyGraphIRMigration(normalizeAnalysisResult(run.output));
    const result = applyA2ANormalization(baseline, {
      model,
      timeoutMs: run.timeoutMs,
      elapsedMs: run.diagnostics.elapsedMs,
      onProgress: writeProgress
    });
    const errors = validateAnalysisResult(result);
    if (errors.length) {
      console.error("[codex-analyzer] 응답 검증 실패:", errors);
      writeProgress({
        phase: "failed",
        message: `Codex SDK 응답 검증 실패: ${errors.join("; ")}`,
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
  await writeAnalyzerContextIndex({ repoRoot, resultSchemaPath: schemaPath, draftSchemaPath, catalog, contextIndexPath });
  const prompt = buildPrompt(input, catalog, contextIndexPath);
  const outputSchema = JSON.parse(await readFile(draftSchemaPath, "utf8"));
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
      const output = hydrateAnalysisDraft(parseJsonObject(outputText), { input, catalog });
      onProgress?.({
        phase: "diagnostic",
        message: "Codex SDK 실행 계측을 수집했습니다.",
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
    } catch (parseError) {
      const failure = summarizeProcessFailure(stdout, stderr);
      throw createAnalyzerError(
        "failed",
        `Codex SDK compact draft를 해석하지 못했습니다. ${parseError instanceof Error ? parseError.message : "unknown parse error"}${failure.message ? ` ${failure.message}` : ""}`.trim(),
        {
          ...diagnostics,
          timeoutMs,
          lastTraceSnippet: failure.snippet || diagnostics.lastTraceSnippet
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

interface AnalysisDraftHydrationContext {
  input: Record<string, unknown>;
  catalog: SanitizedCatalogEntry[];
}

function hydrateAnalysisDraft(draft: unknown, ctx: AnalysisDraftHydrationContext): unknown {
  if (!isRecord(draft)) {
    return draft;
  }
  const catalogById = new Map(ctx.catalog.map((entry) => [entry.id, entry]));
  const catalogByName = new Map(ctx.catalog.map((entry) => [entry.name, entry]));
  const normalizedRequirement = hydrateNormalizedRequirement(draft.normalizedRequirement, ctx.input);
  const evidence = hydrateEvidence(draft.evidence, normalizedRequirement);
  const moduleCandidates = hydrateModuleCandidates(draft.moduleCandidates, catalogById, catalogByName);
  const processFlow = hydrateProcessFlow(draft.processFlow, moduleCandidates);
  return {
    normalizedRequirement,
    evidence,
    moduleCandidates,
    a2aContracts: [],
    runtimeContracts: [],
    processFlow
  };
}

function hydrateNormalizedRequirement(value: unknown, input: Record<string, unknown>): Record<string, unknown> {
  const record = isRecord(value) ? value : {};
  const requester = isRecord(record.requester) ? record.requester : {};
  const rawText = stringOr(record.raw_text, stringOr(input.rawText, ""));
  const domain = stringOr(record.domain, stringOr(input.domain, "공통"));
  return {
    id: "req-001",
    title: stringOr(record.title, "제목 없는 요구사항"),
    raw_text: rawText,
    domain,
    requester: {
      team: stringOr(requester.team, "needs_info"),
      role: stringOr(requester.role, "needs_info")
    },
    business_goal: stringOr(record.business_goal, "needs_info"),
    current_process: stringArrayOr(record.current_process),
    inputs: hydrateFields(record.inputs),
    outputs: hydrateFields(record.outputs),
    systems: hydrateSystems(record.systems),
    risk_signals: riskSignalArrayOr(record.risk_signals),
    missing_information: stringArrayOr(record.missing_information),
    contradictions: stringArrayOr(record.contradictions),
    status: requirementStatuses.has(String(record.status)) ? record.status : "draft"
  };
}

function hydrateEvidence(value: unknown, normalizedRequirement: Record<string, unknown>): Record<string, unknown> {
  const record = isRecord(value) ? value : {};
  return {
    requested_goal: stringOr(record.requested_goal, stringOr(normalizedRequirement.business_goal, "needs_info")),
    business_domain_hint: stringOr(record.business_domain_hint, stringOr(normalizedRequirement.domain, "공통")),
    user_role: stringOr(record.user_role, "needs_info"),
    input_data: stringArrayOr(record.input_data),
    output_data: stringArrayOr(record.output_data),
    systems_mentioned: stringArrayOr(record.systems_mentioned),
    decisions_implied: stringArrayOr(record.decisions_implied),
    risk_signals: riskSignalArrayOr(record.risk_signals, riskSignalArrayOr(normalizedRequirement.risk_signals)),
    missing_information: stringArrayOr(record.missing_information),
    contradictions: stringArrayOr(record.contradictions),
    assumptions: stringArrayOr(record.assumptions)
  };
}

function hydrateModuleCandidates(
  value: unknown,
  catalogById: Map<string, SanitizedCatalogEntry>,
  catalogByName: Map<string, SanitizedCatalogEntry>
): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((candidate, index) => {
    const catalogId = stringOr(candidate.catalog_entry_id, "");
    const candidateName = stringOr(candidate.name, "") ?? "";
    const catalogEntry = (catalogId ? catalogById.get(catalogId) : undefined) ?? catalogByName.get(candidateName);
    const category = enumOr(candidate.module_category, moduleCategories, catalogEntry?.module_category ?? "adapter");
    const subtype = stringOr(candidateSubType(candidate, category), catalogEntry?.subtype ?? null);
    const riskSignals = riskSignalArrayOr(candidate.risk_signals, riskSignalArrayOr(catalogEntry?.risk_signals));
    const auditRequired = riskSignals.includes("audit_required");
    const result: Record<string, unknown> = {
      id: normalizeModuleId(candidate.id, index),
      source_requirement_id: "req-001",
      catalog_entry_id: catalogEntry?.id ?? null,
      name: catalogEntry?.name ?? stringOr(candidate.name, `module-${index + 1}`),
      module_category: category,
      agent_kind: category === "agent" ? enumOr(subtype, agentKinds, "specialist") : null,
      workflow_kind: category === "workflow" ? enumOr(subtype, workflowKinds, "unknown") : null,
      adapter_kind: category === "adapter" ? enumOr(subtype, adapterKinds, "unknown") : null,
      remote_contract_kind: category === "remote_a2a" ? enumOr(subtype, remoteContractKinds, "a2a") : null,
      access_protocol: catalogEntry?.access_protocol ?? null,
      mcp_server: catalogEntry?.mcp_server,
      mcp_tool_name: catalogEntry?.mcp_tool_name,
      mcp_schema_ref: catalogEntry?.mcp_schema_ref,
      mcp_auth_mode: catalogEntry?.mcp_auth_mode,
      legacy_recommended_type: legacyRecommendationFor(category),
      confidence: numberInRange(candidate.confidence, 0, 1, 0.7),
      rationale: stringOr(candidate.rationale, catalogEntry?.responsibility ?? "needs_info"),
      adk_hints: hydrateAdkHints(candidate.adk_hints),
      inputs: hydrateFields(candidate.inputs, hydrateFields(catalogEntry?.inputs)),
      outputs: hydrateFields(candidate.outputs, hydrateFields(catalogEntry?.outputs)),
      reuse_candidate: typeof candidate.reuse_candidate === "boolean" ? candidate.reuse_candidate : Boolean(catalogEntry),
      risk_level: enumOr(candidate.risk_level, riskLevels, riskLevelFor(category, riskSignals)),
      risk_signals: riskSignals,
      status: enumOr(candidate.status, moduleStatuses, "needs_info"),
      missing_information: stringArrayOr(candidate.missing_information),
      side_effect: enumOr(candidate.side_effect, new Set(["none", "read", "write", "read_write", "unknown"]), defaultSideEffect(category)),
      auth_required: false,
      audit_required: auditRequired,
      citation_required: category === "adapter" && subtype === "retrieval" ? true : null,
      grounding_required: category === "adapter" && subtype === "retrieval" ? true : null,
      source_acl_required: riskSignals.includes("personal_data") || riskSignals.includes("financial_data") ? true : null,
      versioned: category === "adapter" && (subtype === "rule_registry" || subtype === "template"),
      effective_date_required: subtype === "retrieval" || subtype === "rule_registry" ? true : null,
      owner_domain: stringOr(candidate.owner_domain, catalogEntry?.owner_domain ?? null),
      owner: category === "remote_a2a" ? "needs_info" : null,
      agent_card: category === "remote_a2a" ? "needs_info" : null,
      auth: category === "remote_a2a" ? "needs_info" : null,
      task_lifecycle: category === "remote_a2a" ? "needs_info" : null,
      timeout: category === "remote_a2a" ? "needs_info" : null,
      retry: category === "remote_a2a" ? "needs_info" : null,
      fallback: category === "remote_a2a" ? "needs_info" : null,
      audit: category === "remote_a2a" ? "needs_info" : null,
      data_policy: category === "remote_a2a" ? "needs_info" : null,
      a2a_contract_id: category === "remote_a2a" ? stringOr(candidate.a2a_contract_id, null) : null
    };
    const developerTodos = stringArrayOr(candidate.developer_todos);
    if (developerTodos.length > 0) {
      result.developer_todos = developerTodos;
    }
    return result;
  });
}

function hydrateProcessFlow(value: unknown, moduleCandidates: Record<string, unknown>[]): Record<string, unknown> {
  const record = isRecord(value) ? value : {};
  const nodes = hydrateGraphNodes(record.nodes, moduleCandidates);
  const edges = hydrateGraphEdges(record.edges, nodes);
  const containers = hydrateGraphContainers(record.containers, nodes);
  return {
    requirement_id: "req-001",
    graph_id: normalizeGraphId(record.graph_id),
    root_workflow_module_id: stringOr(
      record.root_workflow_module_id,
      stringOr(moduleCandidates.find((candidate) => candidate.module_category === "workflow")?.id, null)
    ),
    nodes,
    edges,
    containers,
    lanes: hydrateGraphLanes(record.lanes, nodes),
    validation: {
      ok: true,
      errors: [],
      warnings: []
    }
  };
}

function hydrateGraphNodes(value: unknown, moduleCandidates: Record<string, unknown>[]): Record<string, unknown>[] {
  const moduleById = new Map(moduleCandidates.map((candidate) => [String(candidate.id), candidate]));
  const rawNodes = Array.isArray(value) && value.some(isRecord) ? value.filter(isRecord) : synthesizeGraphNodes(moduleCandidates);
  return rawNodes.map((node, index) => {
    const nodeKind = enumOr(node.node_kind, graphNodeKinds, inferNodeKind(node, moduleById));
    const moduleId = moduleBoundNodeKind(nodeKind) ? stringOr(node.module_id, inferModuleIdFromNode(node, moduleById)) : null;
    const ownerScope = enumOr(node.owner_scope, new Set(["local", "remote", "external"]), nodeKind === "remote_a2a" ? "remote" : "local");
    const laneId = enumOr(node.lane_id, graphLaneIds, laneForNodeKind(nodeKind));
    return {
      id: stringOr(node.id, `node-${String(index + 1).padStart(3, "0")}`),
      module_id: moduleId,
      label: stringOr(node.label, stringOr(moduleById.get(String(moduleId))?.name, `node-${index + 1}`)),
      node_kind: nodeKind,
      execution_kind: stringOr(node.execution_kind, null),
      agent_execution_mode: nodeKind === "agent" ? enumOr(node.agent_execution_mode, agentExecutionModes, "single_turn") : null,
      adk_node_role: enumOr(
        node.adk_node_role,
        new Set(["workflow_node", "container_root", "boundary", "synthetic"]),
        nodeKind === "remote_a2a" ? "boundary" : moduleBoundNodeKind(nodeKind) ? "workflow_node" : "synthetic"
      ),
      owner_scope: ownerScope,
      container_id: stringOr(node.container_id, nodeKind === "remote_a2a" || nodeKind === "remote_agent_call" ? "container-remote" : "container-root"),
      lane_id: laneId,
      input_ports: [],
      output_ports: [],
      schema_refs: stringArrayOr(node.schema_refs),
      review_status: enumOr(node.review_status, new Set(["needs_info", "approved", "deferred", "rejected", "n/a"]), moduleBoundNodeKind(nodeKind) ? "needs_info" : "n/a"),
      workflow_ref: isRecord(node.workflow_ref) ? node.workflow_ref : null,
      input_schema: stringOr(node.input_schema, null),
      output_schema: stringOr(node.output_schema, null),
      input_mapping: isRecord(node.input_mapping) ? node.input_mapping : null,
      output_mapping: isRecord(node.output_mapping) ? node.output_mapping : null,
      runtime_binding: stringOr(node.runtime_binding, null),
      mock_binding: isRecord(node.mock_binding) ? node.mock_binding : null,
      adk_skeleton_contract: isRecord(node.adk_skeleton_contract) ? node.adk_skeleton_contract : null
    };
  });
}

function synthesizeGraphNodes(moduleCandidates: Record<string, unknown>[]): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [{ id: "node-input", label: "요구사항 입력", node_kind: "input" }];
  for (const candidate of moduleCandidates) {
    const category = String(candidate.module_category);
    nodes.push({
      id: `node-${candidate.id}`,
      label: String(candidate.name),
      node_kind: category === "remote_a2a" ? "remote_a2a" : category,
      module_id: String(candidate.id)
    });
  }
  nodes.push({ id: "node-output", label: "분석 결과", node_kind: "output" });
  return nodes;
}

function hydrateGraphEdges(value: unknown, nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  const rawEdges = Array.isArray(value) && value.some(isRecord) ? value.filter(isRecord) : synthesizeGraphEdges(nodes);
  return rawEdges.map((edge, index) => {
    const edgeKind = enumOr(edge.edge_kind, graphEdgeKinds, "event_output");
    const remote = edgeKind === "remote_a2a" || edge.is_remote_boundary_crossing === true;
    return {
      id: stringOr(edge.id, `edge-${String(index + 1).padStart(3, "0")}`),
      from: stringOr(edge.from, ""),
      to: stringOr(edge.to, ""),
      from_port: null,
      to_port: null,
      edge_kind: edgeKind,
      execution_semantics: enumOr(edge.execution_semantics, graphExecutionSemantics, remote ? "boundary_crossing" : "normal_transition"),
      data_label: stringOr(edge.data_label, ""),
      schema_ref: stringOr(edge.schema_ref, null),
      route_condition: stringOr(edge.route_condition, null),
      state_key: stringOr(edge.state_key, null),
      artifact_key: stringOr(edge.artifact_key, null),
      a2a_contract_id: stringOr(edge.a2a_contract_id, null),
      is_remote_boundary_crossing: remote
    };
  });
}

function synthesizeGraphEdges(nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  const edges: Record<string, unknown>[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    edges.push({
      id: `edge-${String(i + 1).padStart(3, "0")}`,
      from: nodes[i].id,
      to: nodes[i + 1].id,
      edge_kind: "event_output",
      execution_semantics: "normal_transition",
      data_label: ""
    });
  }
  return edges;
}

function hydrateGraphContainers(value: unknown, nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(value) && value.some(isRecord)) {
    return value.filter(isRecord).map((container) => ({
      id: stringOr(container.id, "container-root"),
      module_id: stringOr(container.module_id, null),
      label: stringOr(container.label, "Root graph workflow"),
      container_kind: enumOr(container.container_kind, graphContainerKinds, "graph_workflow"),
      adk_mapping: stringOr(container.adk_mapping, null),
      contains_node_ids: stringArrayOr(container.contains_node_ids),
      entry_node_ids: stringArrayOr(container.entry_node_ids),
      exit_node_ids: stringArrayOr(container.exit_node_ids),
      layout_policy: enumOr(container.layout_policy, graphLayoutPolicies, "dag_with_routes"),
      parent_container_id: stringOr(container.parent_container_id, null)
    }));
  }
  const localIds = nodes.filter((node) => node.owner_scope !== "remote").map((node) => String(node.id));
  const remoteIds = nodes.filter((node) => node.owner_scope === "remote").map((node) => String(node.id));
  const containers: Record<string, unknown>[] = [
    {
      id: "container-root",
      module_id: null,
      label: "Root graph workflow",
      container_kind: "graph_workflow",
      adk_mapping: "ADK Graph Workflow",
      contains_node_ids: localIds,
      entry_node_ids: nodes.filter((node) => node.node_kind === "input").map((node) => String(node.id)),
      exit_node_ids: nodes.filter((node) => node.node_kind === "output").map((node) => String(node.id)),
      layout_policy: "dag_with_routes",
      parent_container_id: null
    }
  ];
  if (remoteIds.length > 0) {
    containers.push({
      id: "container-remote",
      module_id: null,
      label: "Remote A2A boundary",
      container_kind: "remote_boundary",
      adk_mapping: "A2A remote boundary",
      contains_node_ids: remoteIds,
      entry_node_ids: remoteIds,
      exit_node_ids: remoteIds,
      layout_policy: "free",
      parent_container_id: null
    });
  }
  return containers;
}

function hydrateGraphLanes(value: unknown, nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(value) && value.some(isRecord)) {
    return value.filter(isRecord).map((lane) => ({
      id: enumOr(lane.id, graphLaneIds, "local_graph"),
      label: stringOr(lane.label, String(lane.id ?? "local_graph"))
    }));
  }
  const used = new Set(nodes.map((node) => String(node.lane_id)));
  const labels: Record<string, string> = {
    input: "Input",
    local_graph: "Local Graph",
    adapter: "Adapter",
    human_input: "Human Input",
    output: "Output",
    remote_boundary: "Remote Boundary"
  };
  return Array.from(graphLaneIds)
    .filter((lane) => used.has(lane) || lane === "input" || lane === "local_graph" || lane === "output")
    .map((id) => ({ id, label: labels[id] }));
}

function stringOr(value: unknown, fallback: string | null): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

function stringArrayOr(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function riskSignalArrayOr(value: unknown, fallback: string[] = []): string[] {
  return stringArrayOr(value, fallback).filter((signal) => riskSignals.has(signal));
}

function hydrateFields(
  value: unknown,
  fallback: Array<{ name: string; type: string; required?: boolean; schema?: unknown }> = []
): Array<{ name: string; type: string; required: boolean; schema?: unknown }> {
  const source = Array.isArray(value) ? value : fallback;
  return source.filter(isRecord).map((field) => ({
    name: stringOr(field.name, "field") ?? "field",
    type: stringOr(field.type, "unknown") ?? "unknown",
    required: typeof field.required === "boolean" ? field.required : false,
    ...(isRecord(field.schema) ? { schema: field.schema } : {})
  }));
}

function hydrateSystems(value: unknown): Array<{ name: string; access: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord).map((system) => ({
    name: stringOr(system.name, "needs_info") ?? "needs_info",
    access: enumOr(system.access, systemAccess, "unknown")
  }));
}

function hydrateAdkHints(value: unknown): Record<string, string | null> {
  const record = isRecord(value) ? value : {};
  return {
    state_memory: stringOr(record.state_memory, null),
    callbacks: stringOr(record.callbacks, null),
    artifacts_events: stringOr(record.artifacts_events, null),
    mcp_a2a: stringOr(record.mcp_a2a, null),
    streaming_grounding: stringOr(record.streaming_grounding, null)
  };
}

function enumOr<T extends string>(value: unknown, allowed: ReadonlySet<T> | Set<T>, fallback: T): T {
  return typeof value === "string" && allowed.has(value as T) ? (value as T) : fallback;
}

function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

function normalizeModuleId(value: unknown, index: number): string {
  return typeof value === "string" && /^mod-[a-z0-9-]+$/.test(value)
    ? value
    : `mod-${String(index + 1).padStart(3, "0")}`;
}

function normalizeGraphId(value: unknown): string {
  return typeof value === "string" && /^graph-[0-9]+$/.test(value) ? value : "graph-001";
}

function candidateSubType(candidate: Record<string, unknown>, category: string): string | null {
  if (category === "agent") return stringOr(candidate.agent_kind, null);
  if (category === "workflow") return stringOr(candidate.workflow_kind, null);
  if (category === "adapter") return stringOr(candidate.adapter_kind, null);
  if (category === "remote_a2a") return stringOr(candidate.remote_contract_kind, null);
  return null;
}

function legacyRecommendationFor(category: string): string {
  if (category === "agent") return "specialist_agent";
  if (category === "workflow") return "internal_workflow";
  if (category === "adapter") return "tool_adapter";
  if (category === "remote_a2a") return "remote_a2a_contract";
  return "unknown";
}

function riskLevelFor(category: string, signals: string[]): "low" | "medium" | "high" {
  if (category === "remote_a2a") return "high";
  if (signals.some((signal) => signal === "personal_data" || signal === "financial_data" || signal === "transaction_write")) {
    return "high";
  }
  if (signals.length > 0) return "medium";
  return "low";
}

function defaultSideEffect(category: string): "none" | "read" | "write" | "read_write" | "unknown" {
  if (category === "adapter") return "read";
  if (category === "agent" || category === "workflow") return "read";
  return "unknown";
}

function moduleBoundNodeKind(kind: string): boolean {
  return (
    kind === "agent" ||
    kind === "workflow" ||
    kind === "workflow_call" ||
    kind === "adapter" ||
    kind === "adapter_call" ||
    kind === "remote_a2a" ||
    kind === "remote_agent_call"
  );
}

function inferNodeKind(node: Record<string, unknown>, moduleById: Map<string, Record<string, unknown>>): string {
  const moduleId = stringOr(node.module_id, null);
  const category = moduleId ? moduleById.get(moduleId)?.module_category : null;
  if (category === "remote_a2a") return "remote_a2a";
  if (typeof category === "string" && graphNodeKinds.has(category)) return category;
  return "function";
}

function inferModuleIdFromNode(node: Record<string, unknown>, moduleById: Map<string, Record<string, unknown>>): string | null {
  const direct = stringOr(node.module_id, null);
  if (direct) return direct;
  const id = stringOr(node.id, "");
  if (id && id.startsWith("node-mod-")) {
    const candidateId = id.slice("node-".length);
    if (moduleById.has(candidateId)) return candidateId;
  }
  return null;
}

function laneForNodeKind(kind: string): string {
  if (kind === "input") return "input";
  if (kind === "output") return "output";
  if (kind === "adapter" || kind === "adapter_call" || kind === "tool") return "adapter";
  if (kind === "human_input") return "human_input";
  if (kind === "remote_a2a" || kind === "remote_agent_call") return "remote_boundary";
  return "local_graph";
}

async function writeAnalyzerContextIndex({
  repoRoot,
  resultSchemaPath,
  draftSchemaPath,
  catalog,
  contextIndexPath
}: {
  repoRoot: string;
  resultSchemaPath: string;
  draftSchemaPath: string;
  catalog: SanitizedCatalogEntry[];
  contextIndexPath: string;
}) {
  const files = [
    "docs/workbench/taxonomy.md",
    "docs/workbench/workflow-decision-guide.md",
    "docs/workbench/process-flow.md",
    "docs/workbench/analysis-guide.md",
    "schemas/analysis-result.schema.json",
    "schemas/analysis-draft.schema.json",
    "catalog/adapters.yaml",
    "catalog/agents.yaml",
    "catalog/workflows.yaml",
    "catalog/remote-a2a-contracts.yaml"
  ];
  const summaries: string[] = [];
  for (const file of files) {
    const abs = resolve(repoRoot, file);
    const text = await readFile(abs, "utf8").catch(() => "");
    const headings = text
      .split(/\r?\n/)
      .map((line, index) => ({ line, index: index + 1 }))
      .filter(({ line }) => /^#{1,3}\s+/.test(line))
      .slice(0, 24)
      .map(({ line, index }) => `  - L${index}: ${line.replace(/^#+\s*/, "")}`);
    summaries.push([`- ${file} (${text.length} chars)`, ...headings].join("\n"));
  }

  const catalogSummary = catalog.map((entry) => ({
    id: entry.id,
    name: entry.name,
    module_category: entry.module_category,
    subtype: entry.subtype,
    runtime_binding: entry.runtime_binding,
    access_protocol: entry.access_protocol,
    mcp_server: entry.mcp_server,
    mcp_tool_name: entry.mcp_tool_name,
    owner_domain: entry.owner_domain,
    contract_status: entry.contract_status
  }));

  await writeFile(
    contextIndexPath,
    [
      "# Agent Factory Analyzer Context Index",
      "",
      "Use this file as a navigation index. It is not a substitute for the source files.",
      "Read the original docs/schema/catalog with targeted sed/rg when a classification or Graph IR decision depends on exact wording.",
      "",
      `- Final hydrated schema: ${resultSchemaPath}`,
      `- Codex SDK compact draft schema passed as outputSchema: ${draftSchemaPath}`,
      "",
      "## Source Files",
      "",
      summaries.join("\n"),
      "",
      "## Catalog Contract Index",
      "",
      JSON.stringify(catalogSummary, null, 2)
    ].join("\n"),
    "utf8"
  );
}

interface SanitizedCatalogEntry {
  id: string;
  name: string;
  module_category: string;
  subtype: string | null;
  runtime_binding?: string;
  access_protocol?: string;
  mcp_server?: string;
  mcp_tool_name?: string;
  mcp_schema_ref?: string;
  mcp_auth_mode?: string;
  component_source?: string;
  contract_status?: string;
  owner_domain?: string;
  status?: string;
  responsibility?: string;
  inputs?: Array<{ name: string; type: string; required?: boolean }>;
  outputs?: Array<{ name: string; type: string; required?: boolean }>;
  composition?: string[];
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
    const inputs = sanitizeCatalogFields(item.inputs);
    const outputs = sanitizeCatalogFields(item.outputs);
    const composition = sanitizeStringList(item.composition, 16, 240);
    sanitized.push({
      id,
      name,
      module_category: moduleCategory,
      subtype: subtypeRaw ?? null,
      runtime_binding: stringField(item, "runtime_binding", 40),
      access_protocol: stringField(item, "access_protocol", 32),
      mcp_server: stringField(item, "mcp_server", 120),
      mcp_tool_name: stringField(item, "mcp_tool_name", 120),
      mcp_schema_ref: stringField(item, "mcp_schema_ref", 160),
      mcp_auth_mode: stringField(item, "mcp_auth_mode", 80),
      component_source: stringField(item, "component_source", 40),
      contract_status: stringField(item, "contract_status", 80),
      owner_domain: stringField(item, "owner_domain", 120),
      status: stringField(item, "status", 80),
      responsibility: stringField(item, "responsibility", 320),
      inputs: inputs.length ? inputs : undefined,
      outputs: outputs.length ? outputs : undefined,
      composition: composition.length ? composition : undefined,
      risk_signals: risk_signals && risk_signals.length ? risk_signals : undefined
    });
  }
  return sanitized;
}

function sanitizeStringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeCatalogFields(value: unknown): Array<{ name: string; type: string; required?: boolean }> {
  if (!Array.isArray(value)) return [];
  const result: Array<{ name: string; type: string; required?: boolean }> = [];
  for (const item of value) {
    if (result.length >= 12) break;
    if (!isRecord(item)) continue;
    const rawName = item.name;
    const rawType = item.type;
    if (typeof rawName !== "string" || typeof rawType !== "string") continue;
    const name = rawName.trim().slice(0, 80);
    const type = rawType.trim().slice(0, 120);
    if (!name || !type) continue;
    const field: { name: string; type: string; required?: boolean } = { name, type };
    if (typeof item.required === "boolean") field.required = item.required;
    result.push(field);
  }
  return result;
}

function buildPrompt(input: Record<string, unknown>, catalog: SanitizedCatalogEntry[], contextIndexPath: string): string {
  const sections: string[] = [
    "You are the live requirement analyzer for the Agent Factory workbench. Human-visible prose must be Korean-first.",
    "Return only JSON matching schemas/analysis-draft.schema.json. No markdown, no commentary.",
    "The server will hydrate your compact draft into schemas/analysis-result.schema.json after you finish.",
    "Do not emit the full final AnalysisResult shape. Emit only the compact draft fields requested by the output schema.",
    "",
    "Context access:",
    `- First read the analyzer context index at ${contextIndexPath}.`,
    "- The index is only a navigation aid. Use targeted sed/rg on the original docs/schema/catalog files when exact wording matters.",
    "- Shell access remains available because analysis quality depends on source-grounded docs and schema checks.",
    "- Avoid dumping entire large files when a targeted section is enough; prefer rg and bounded sed ranges.",
    "",
    "ADK runtime baseline:",
    "- ADK 2.3 is the default mental model: graph-based deterministic workflows with explicit nodes/edges, dynamic (Python-driven) workflows, built-in parallel/merge, first-class human-input nodes, and trace/token observability.",
    "- Workflow means the broad Workflow Agent boundary. Do not emit small pattern workflow_kind values for sequence, parallelism, loops, or human review; represent those inside Graph IR.",
    "",
    "Authoritative references - consult these before deciding:",
    "- docs/workbench/taxonomy.md (module_category, *_kind enums including orchestration/graph/dynamic, Remote A2A conditions) — read from the working tree.",
    "- docs/workbench/workflow-decision-guide.md (Workflow Agent classification and Graph IR representation rules).",
    "- docs/workbench/process-flow.md (native Graph IR node, container, edge, stage projection, and marker rules).",
    "- adk-docs-mcp — use list_doc_sources/fetch_docs for ADK 2.3 component facts (graph workflow, dynamic workflow, human-input node, trace/token observability) and for the version-neutral component set: Sessions/State/Memory, Callbacks, Artifacts/Events, Apps/Plugins, MCP, A2A, Streaming, Grounding. This is the source of truth for adk_hints; do not use 1.x workflow-agent class names as classification criteria.",
    "",
    "Do not paraphrase the docs into long output. Use them only to ground classification, adk_hints, and processFlow shape.",
    "",
    "Compact draft output rules:",
    "- RequirementIntakeInput intentionally contains only a selected domain and rawText. Infer title, requester, systems, inputs, outputs, process, and missing details from rawText instead of expecting separate intake fields.",
    "- Use RequirementIntakeInput.domain as the user's selected domain unless rawText clearly contradicts it; record any contradiction in normalizedRequirement.contradictions.",
    "- normalizedRequirement.id = \"req-001\"; every module source_requirement_id = \"req-001\".",
    "- Number module ids sequentially as mod-001, mod-002, mod-003, ... with no gaps.",
    "- For catalog reuse, set reuse_candidate=true, set catalog_entry_id to the exact catalog id, and keep the catalog entry name verbatim. You may omit repeated catalog inputs/outputs when unchanged; the server hydrates them.",
    "- For new modules, include inputs/outputs when they are materially needed to explain the contract.",
    "- Include concise Korean rationale, missing_information, assumptions, developer_todos, smoke_spec.sample_user_message, processFlow labels/descriptions, and runtime contract summaries. Do not generate runnable business logic, credentials, private endpoints, deployment scripts, or real banking integration details.",
    "",
    "Process flow output — compact Graph IR draft (NOT a stage list):",
    "- processFlow MUST contain nodes, edges, containers, lanes, and validation because the Codex response_format schema requires all object keys. Use [] for containers/lanes when the default root graph container is enough; the server hydrates required Graph IR defaults.",
    "- Field specs in inputs/outputs MUST include name, type, required, and schema. Use schema: {} when a precise JSON Schema is not known yet.",
    "- Graph IR ids must use canonical final artifact forms: edge ids like edge-001, edge-002, edge-003; container ids like container-root, container-human-review, container-parallel-customer-data. Do not use e-001, c-root, c-human-review, or other shorthand.",
    "- node.container_id and container.parent_container_id must exactly reference an emitted container id. If you are unsure about a custom container boundary, use containers: [] and let the server hydrate the default root container.",
    "- DO NOT emit a top-level `stages` field anywhere. The validator rejects it.",
    "- DO NOT emit legacy node fields `type`/`subtype` or legacy edge fields `edge_type`/`data`/`data_channel`.",
    `- Allowed node_kind: ${GRAPH_NODE_KINDS.join(", ")}.`,
    `- Allowed edge_kind: ${GRAPH_EDGE_KINDS.join(", ")}.`,
    `- Allowed container_kind: ${GRAPH_CONTAINER_KINDS.join(", ")}.`,
    "- For processFlow.nodes, set agent_execution_mode to \"single_turn\" or \"chat\" only for node_kind \"agent\". Use \"single_turn\" by default. Use null for every non-agent node. Do not emit \"task\".",
    "- Routes need an explicit router node; loops need a loop_region container; parallel needs a parallel_region and join node when the requirement actually implies those structures.",
    "- Human input must be modeled as node_kind: \"human_input\" (NOT an LLM agent in disguise). Its outbound edge to a router or downstream node is typically event_message or route.",
    "- Module-bound node kinds (agent, workflow, adapter, remote_a2a) should set module_id to the matching candidate id. Synthetic node kinds should use null or omit module_id.",
    "- Do NOT infer Remote A2A from local complexity. Multi-step local workflow alone is NOT enough to propose a remote_a2a node, edge, or container.",
    "- Module status must be one of needs_info, deferred, rejected; never approved.",
    "- a2aContracts must be present; use [] when there is no Remote A2A draft. The server hydrates placeholder A2A contracts for real remote_a2a candidates.",
    "- runtimeContracts must be present; use [] unless the compact draft intentionally includes a minimal contract_id/contract_kind/contract_status record. The server derives Runtime contract review drafts for EAI/Legacy, MCP, Context Manager, Callback Broker, ADK callback, and async resume signals. If you emit any runtimeContracts text field yourself, write the reviewer-facing text in Korean-first prose.",
    "- adk_hints should be concise and grounded in adk-docs-mcp when relevant. Use only these keys: state_memory, callbacks, artifacts_events, mcp_a2a, streaming_grounding.",
    "",
    "Taxonomy guardrails:",
    "- Use module_category only from agent, workflow, adapter, remote_a2a.",
    "- Allowed workflow_kind values: orchestration, graph, dynamic, unknown.",
    "- Do not emit workflow_kind sequential, parallel, loop, or human_review. Those are Graph IR representation details: normal_transition/fan_out/fan_in/loop_back/loop_exit, parallel_region, loop_region, human_review_region, router, join, and human_input nodes.",
    "- Pick graph when the requirement implies an explicit node/edge orchestration with deterministic routing, branches, joins, loops, or human input (ADK graph workflow).",
    "- Pick dynamic when control flow is code-driven (Python conditionals/loops/custom logic) rather than declarative — for example, when the dynamic dimension dominates over the declarative graph (ADK dynamic workflow).",
    "- Pick orchestration when the requirement describes high-level coordination but does not yet justify a fully explicit graph or dynamic workflow. Still emit the observable flow as native Graph IR.",
    "- Retrieval and Rule Registry are adapter_kind values, not top-level categories.",
    "- EAI/Legacy access should be adapter_kind legacy_api. Callback Broker and Context Manager are runtimeContracts that must be reviewed before Runtime Handoff.",
    "- Remote A2A is high-friction and requires an independently owned remote agent protocol boundary, not just multiple local steps.",
    "- Unknown facts belong in missing_information, contradictions, assumptions, rationale, or status; do not ask follow-up questions.",
    "",
    "Remote A2A discipline (spec §4) — Remote A2A is high-friction and must not be inferred from multi-step local processing alone. Only classify a candidate as remote_a2a when there is explicit evidence of an independently owned, deployed, discoverable remote agent (separate owner/lifecycle, Agent Card or registry discovery, A2A-specific lifecycle/streaming/artifact semantics, cross-deployment delegation). When such evidence is missing but the requirement otherwise looks remote-shaped, classify the capability as agent/workflow/adapter and append the missing remote details (owner, agent_card, auth, task_lifecycle, timeout, retry, fallback, audit, data_policy) to missing_information rather than fabricating a Remote A2A boundary.",
    "",
    "Korean prose for human-visible fields; keep engineering terms in English (Agent, Workflow, Adapter, Remote A2A, module_category, adapter_kind, Session/State, placeholder).",
    "Preserve important rawText terms and make rationales specific enough that a reviewer can explain why each module exists."
  ];

  if (catalog.length) {
    sections.push(
      "",
      "Registered shared catalog (already-approved reusable agents/workflows/adapters/remote contracts):",
      "- Treat this list as the source of truth for what already exists in the workbench. Prefer reuse over inventing a new module.",
      "- Catalog entries are reviewed runtime contracts. Some seed entries may include deterministic synthetic runtime_mock payloads for local smoke tests; treat those payloads as test doubles, not private business logic or new module categories.",
      "- Do not create mock-only analysis modules from catalog metadata. Reuse the catalog contract when the requirement matches; scaffold/runtime handoff may use runtime_mock later.",
      "- When a candidate's responsibility, inputs, outputs, subtype, owner_domain, and access protocol match an existing entry, set the candidate's name to the catalog entry's name verbatim, set reuse_candidate to true, and explain the binding in rationale (mention the catalog entry name and id).",
      "- Copy the catalog inputs and outputs onto a reused candidate unless the requirement narrows them; explain any narrowing in rationale or missing_information.",
      "- For reused workflow entries, honor the registered composition list as the intended orchestration structure and mention any missing component in missing_information. If runtime_binding is \"remote_a2a\", explain that this is a catalog runtime binding for the workflow, not a new module_category: remote_a2a candidate by itself.",
      "- Adapters with access_protocol \"mcp\" reuse the registered mcp_server / mcp_tool_name / mcp_schema_ref / mcp_auth_mode; copy them onto the candidate exactly. Do not invent server or tool names.",
      "- Catalog entries describe reusable reviewed runtime contracts. Preserve the catalog name on reused candidates so scaffold-plan generation can record the catalog binding and emit a Korean-first reviewed wiring TODO when runtime configuration is still required.",
      "- For partial matches, still emit a candidate but flag the gap in missing_information (e.g. owner mismatch, narrower scope).",
      "- Do not duplicate a catalog entry as a separate new candidate — collapse it into the matching reuse candidate.",
      "- Never fabricate catalog entries that are not in this list.",
      "- In compact draft output, use catalog_entry_id instead of repeating unchanged catalog inputs/outputs.",
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
  return [input.domain, input.rawText]
    .filter((value): value is string => typeof value === "string")
    .reduce((total, value) => total + value.length, 0);
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

export function validateAnalysisResult(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["응답 최상위 값은 객체여야 합니다."];

  validateNormalizedRequirement(value.normalizedRequirement, errors);
  validateEvidence(value.evidence, errors);
  validateModuleCandidates(value.moduleCandidates, errors);
  validateRuntimeContracts(value.runtimeContracts, errors);
  validateProcessFlow(value.processFlow, errors);

  return errors;
}

function validateRuntimeContracts(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("runtimeContracts 배열이 필요합니다.");
    return;
  }
  value.forEach((contract, index) => {
    const label = `runtimeContracts[${index}]`;
    if (!isRecord(contract)) {
      errors.push(`${label} 객체가 필요합니다.`);
      return;
    }
    if (typeof contract.contract_id !== "string" || !/^rtc-[a-z0-9-]+$/.test(contract.contract_id)) {
      errors.push(`${label}.contract_id는 rtc-* 패턴이어야 합니다.`);
    }
    if (typeof contract.contract_kind !== "string" || !runtimeContractKinds.has(contract.contract_kind)) {
      errors.push(`${label}.contract_kind 값이 올바르지 않습니다.`);
    }
    if (typeof contract.contract_status !== "string" || !runtimeContractStatuses.has(contract.contract_status)) {
      errors.push(`${label}.contract_status 값이 올바르지 않습니다.`);
    }
    expectString(contract, "title", errors);
    expectString(contract, "summary", errors);
    expectStringArray(contract.required_review_fields, `${label}.required_review_fields`, errors);
    expectStringArray(contract.identifiers, `${label}.identifiers`, errors);
    expectStringArray(contract.developer_todos, `${label}.developer_todos`, errors);
    ["runtime_support", "operation", "policies", "graph_ir_annotations"].forEach((key) => {
      if (!isRecord(contract[key])) errors.push(`${label}.${key} 객체가 필요합니다.`);
    });
  });
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
  expectString(value, "graph_id", errors);
  if (typeof value.graph_id === "string" && !/^graph-[0-9]+$/.test(value.graph_id)) {
    errors.push("processFlow.graph_id는 graph-NNN 패턴이어야 합니다.");
  }
  if (value.root_workflow_module_id !== null && value.root_workflow_module_id !== undefined && !truthyString(value.root_workflow_module_id)) {
    errors.push("processFlow.root_workflow_module_id는 문자열 또는 null이어야 합니다.");
  }
  if (!Array.isArray(value.containers)) {
    errors.push("processFlow.containers 배열이 필요합니다.");
  } else {
    value.containers.forEach((container, index) => {
      if (!isRecord(container)) {
        errors.push(`processFlow.containers[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(container, "id", errors);
      expectString(container, "label", errors);
      if (typeof container.container_kind !== "string" || !graphContainerKinds.has(container.container_kind)) {
        errors.push(`processFlow.containers[${index}].container_kind 값이 올바르지 않습니다.`);
      }
      if (typeof container.layout_policy !== "string" || !graphLayoutPolicies.has(container.layout_policy)) {
        errors.push(`processFlow.containers[${index}].layout_policy 값이 올바르지 않습니다.`);
      }
      ["contains_node_ids", "entry_node_ids", "exit_node_ids"].forEach((key) => {
        if (!Array.isArray(container[key])) {
          errors.push(`processFlow.containers[${index}].${key} 배열이 필요합니다.`);
        }
      });
    });
  }
  if (!Array.isArray(value.lanes)) {
    errors.push("processFlow.lanes 배열이 필요합니다.");
  }
  if (!isRecord(value.validation)) {
    errors.push("processFlow.validation 객체가 필요합니다.");
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
      if ("type" in node || "subtype" in node) {
        errors.push(`processFlow.nodes[${index}] legacy type/subtype 필드는 허용되지 않습니다.`);
      }
      if (typeof node.node_kind !== "string" || !graphNodeKinds.has(node.node_kind)) {
        errors.push(`processFlow.nodes[${index}].node_kind 값이 올바르지 않습니다.`);
      }
      if (typeof node.lane_id !== "string" || !graphLaneIds.has(node.lane_id)) {
        errors.push(`processFlow.nodes[${index}].lane_id 값이 올바르지 않습니다.`);
      }
      if (node.module_id !== null && node.module_id !== undefined && !truthyString(node.module_id)) {
        errors.push(`processFlow.nodes[${index}].module_id 값은 문자열 또는 null이어야 합니다.`);
      }
      if (!Array.isArray(node.input_ports) || !Array.isArray(node.output_ports) || !Array.isArray(node.schema_refs)) {
        errors.push(`processFlow.nodes[${index}] input_ports/output_ports/schema_refs 배열이 필요합니다.`);
      }
      validateHumanInputContract(node, `processFlow.nodes[${index}]`, errors);
    });
  }
  if (!Array.isArray(value.edges)) {
    errors.push("processFlow.edges 배열이 필요합니다.");
  } else {
    const defaultRouteEdgesByRouter = new Map<string, string[]>();
    value.edges.forEach((edge, index) => {
      if (!isRecord(edge)) {
        errors.push(`processFlow.edges[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(edge, "from", errors);
      expectString(edge, "to", errors);
      expectString(edge, "id", errors);
      if ("edge_type" in edge || "data" in edge || "data_channel" in edge) {
        errors.push(`processFlow.edges[${index}] legacy edge_type/data/data_channel 필드는 허용되지 않습니다.`);
      }
      if (typeof edge.edge_kind !== "string" || !graphEdgeKinds.has(edge.edge_kind)) {
        errors.push(`processFlow.edges[${index}].edge_kind 값이 올바르지 않습니다.`);
      }
      if (typeof edge.execution_semantics !== "string" || !graphExecutionSemantics.has(edge.execution_semantics)) {
        errors.push(`processFlow.edges[${index}].execution_semantics 값이 올바르지 않습니다.`);
      }
      if (typeof edge.is_remote_boundary_crossing !== "boolean") {
        errors.push(`processFlow.edges[${index}].is_remote_boundary_crossing 값은 boolean이어야 합니다.`);
      }
      ["from_port", "to_port", "state_key", "artifact_key", "schema_ref", "route_condition", "a2a_contract_id"].forEach((key) => {
        const field = edge[key];
        if (field !== undefined && field !== null && !truthyString(field)) {
          errors.push(`processFlow.edges[${index}].${key} 값은 문자열 또는 null이어야 합니다.`);
        }
      });
      if (edge.edge_kind === "route" && !truthyString(edge.route_condition)) {
        errors.push(`processFlow.edges[${index}] route edge에는 route_condition이 필요합니다.`);
      }
      validateRouteReviewContract(edge, `processFlow.edges[${index}]`, { defaultRouteEdgesByRouter, errors });
      if (edge.edge_kind === "artifact" && !truthyString(edge.artifact_key)) {
        errors.push(`processFlow.edges[${index}] artifact edge에는 artifact_key가 필요합니다.`);
      }
      if (edge.edge_kind === "remote_a2a" && edge.is_remote_boundary_crossing !== true) {
        errors.push(`processFlow.edges[${index}] remote_a2a edge는 is_remote_boundary_crossing=true여야 합니다.`);
      }
    });
    for (const [routerId, defaults] of defaultRouteEdgesByRouter) {
      if (defaults.length > 1) {
        errors.push(`processFlow router ${routerId} has multiple default route edges: ${defaults.join(", ")}.`);
      }
    }
  }
}

function validateHumanInputContract(node: Record<string, unknown>, label: string, errors: string[]) {
  const contract = node.human_input_contract;
  if (node.node_kind !== "human_input" && contract !== undefined && contract !== null) {
    errors.push(`${label}.human_input_contract is allowed only on human_input nodes.`);
    return;
  }
  if (node.node_kind !== "human_input" || contract === undefined || contract === null) {
    return;
  }
  if (!isRecord(contract)) {
    errors.push(`${label}.human_input_contract must be an object or null.`);
    return;
  }
  if (typeof contract.message !== "string" || !contract.message.trim()) {
    errors.push(`${label}.human_input_contract.message must be a non-empty reviewed prompt.`);
  }
  if (contract.payload_schema_ref !== undefined && contract.payload_schema_ref !== null && !truthyString(contract.payload_schema_ref)) {
    errors.push(`${label}.human_input_contract.payload_schema_ref must be a non-empty string or null.`);
  }
  if (contract.response_schema_ref !== undefined && contract.response_schema_ref !== null && contract.response_schema_ref !== "str") {
    errors.push(
      `${label}.human_input_contract.response_schema_ref ${String(contract.response_schema_ref)} is design-only; runnable currently supports only null or "str".`
    );
  }
  if (contract.response_mapping !== undefined && contract.response_mapping !== null) {
    if (
      !isRecord(contract.response_mapping) ||
      Object.entries(contract.response_mapping).some(([key, value]) => !key.trim() || !truthyString(value))
    ) {
      errors.push(`${label}.human_input_contract.response_mapping must be an object with non-empty string values or null.`);
    }
  }
}

interface RouteReviewValidationContext {
  readonly defaultRouteEdgesByRouter: Map<string, string[]>;
  readonly errors: string[];
}

function isRouteReviewEdge(edge: Record<string, unknown>) {
  return (
    edge.edge_kind === "route" ||
    ((edge.execution_semantics === "loop_back" || edge.execution_semantics === "loop_exit") && edge.edge_kind === "control")
  );
}

function validateRouteReviewContract(edge: Record<string, unknown>, label: string, context: RouteReviewValidationContext) {
  const routeReviewEdge = isRouteReviewEdge(edge);
  if (Array.isArray(edge.route_aliases)) {
    if (edge.route_aliases.length > 0 && !routeReviewEdge) {
      context.errors.push(`${label}.route_aliases is allowed only on route or loop decision edges.`);
    }
    if (edge.route_aliases.some((alias) => typeof alias !== "string" || !alias.trim())) {
      context.errors.push(`${label}.route_aliases entries must be non-empty strings.`);
    }
  } else if (edge.route_aliases !== undefined && edge.route_aliases !== null) {
    context.errors.push(`${label}.route_aliases must be an array of strings or null.`);
  }
  if (edge.is_default_route === true) {
    if (!routeReviewEdge) {
      context.errors.push(`${label}.is_default_route is allowed only on route or loop decision edges.`);
    } else if (typeof edge.from === "string") {
      if (edge.edge_kind === "route") {
        const defaults = context.defaultRouteEdgesByRouter.get(edge.from) ?? [];
        defaults.push(typeof edge.id === "string" ? edge.id : label);
        context.defaultRouteEdgesByRouter.set(edge.from, defaults);
      }
    }
  } else if (edge.is_default_route !== undefined && edge.is_default_route !== null && edge.is_default_route !== false) {
    context.errors.push(`${label}.is_default_route must be boolean or null.`);
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

interface A2ANormalizationContext {
  model: string;
  timeoutMs: number;
  elapsedMs: number;
  onProgress?: (event: AnalyzerProgressEvent) => void;
}

/**
 * Run the shared A2A normalization pass after the Codex SDK returns and
 * before the validator runs. Fills missing remote-A2A contract summary
 * fields with the literal "needs_info", mints a placeholder contract for
 * any remote_a2a candidate that lacks one, and drops orphan contracts.
 *
 * Diagnostics are emitted onto the existing SSE diagnostic channel (when
 * streaming) so they show up in the live trace panel, and onto console.info
 * either way so non-streaming callers still get an audit trail. We do not
 * invent a new event channel — `phase: "diagnostic"` is the same channel the
 * trace panel already consumes.
 */
/**
 * Migrate a legacy stage-flow `processFlow` (if present) into Graph IR and
 * run soft structural validation, merging issues into `processFlow.validation`.
 *
 * Must NEVER throw — §21 (seven-minute-failure regression rule) requires that
 * we always return the analyzer result, even if structurally degraded. The UI
 * then surfaces the validation banner.
 */
function applyGraphIRMigration(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = { ...value };
  try {
    if (isRecord(next.processFlow)) {
      const reqId =
        isRecord(next.normalizedRequirement) && typeof next.normalizedRequirement.id === "string"
          ? (next.normalizedRequirement.id as string)
          : "req-001";
      const migrated = normalizeGraphIRForRuntime(next.processFlow, reqId);
      const soft = validateGraphIRSoft(migrated);
      const mergedValidation = mergeGraphIRValidation(migrated.validation, soft);
      next.processFlow = { ...migrated, validation: mergedValidation };
    }
  } catch (error) {
    console.warn("[codex-analyzer] graph-ir migration failed (non-fatal):", error);
  }
  return next;
}

function applyA2ANormalization(value: unknown, ctx: A2ANormalizationContext): unknown {
  if (!isRecord(value)) {
    return value;
  }
  // The shared module is typed against AnalysisResult. The runtime shape
  // matches by construction (normalizeAnalysisResult preceded us); we cast
  // through unknown to avoid a structural-assignability impedance mismatch
  // with `unknown` upstream.
  const { result, diagnostics } = normalizeA2A(value as unknown as AnalysisResult);
  if (diagnostics.length > 0) {
    emitA2ADiagnostics(diagnostics, ctx);
  }
  return ensureRuntimeContracts(result);
}

function emitA2ADiagnostics(diagnostics: A2ANormalizationDiagnostic[], ctx: A2ANormalizationContext) {
  const at = new Date().toISOString();
  for (const diag of diagnostics) {
    console.info("[codex-analyzer] a2a normalization", {
      kind: diag.kind,
      subjectId: diag.subjectId,
      fields: diag.fields,
      message: diag.message
    });
    if (!ctx.onProgress) continue;
    ctx.onProgress({
      phase: "diagnostic",
      message: diag.message,
      at,
      elapsedMs: ctx.elapsedMs,
      model: ctx.model,
      timeoutMs: ctx.timeoutMs,
      traceKind: "diagnostic",
      title: a2aDiagnosticTitle(diag.kind),
      snippet: diag.fields && diag.fields.length ? diag.fields.join(", ") : undefined,
      status: "info"
    });
  }
}

function a2aDiagnosticTitle(kind: A2ANormalizationDiagnostic["kind"]): string {
  switch (kind) {
    case "candidate_filled":
      return "A2A 후보 placeholder";
    case "contract_filled":
      return "A2A 계약 placeholder";
    case "contract_minted":
      return "A2A 계약 자동 생성";
    case "contract_orphan_removed":
      return "고아 A2A 계약 제거";
    default:
      return "A2A 정규화";
  }
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
