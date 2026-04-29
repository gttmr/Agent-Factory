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
const workflowKinds = new Set(["sequential", "parallel", "loop", "human_review", "orchestration", "unknown"]);
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

type MiddlewareNext = (error?: unknown) => void;

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

      if (!isRecord(input) || typeof input.rawText !== "string" || !input.rawText.trim()) {
        sendJson(res, 400, { error: "원문 요구사항이 필요합니다." });
        return;
      }
      if (typeof model !== "string" || !allowedModels.has(model)) {
        sendJson(res, 400, { error: "허용되지 않은 Codex 모델입니다." });
        return;
      }
      if (isAnalyzing) {
        sendJson(res, 409, { error: "이미 Codex CLI 분석이 진행 중입니다. 완료 후 다시 실행하세요." });
        return;
      }

      isAnalyzing = true;
      try {
        const result = normalizeAnalysisResult(await runCodexAnalyzer({ repoRoot, schemaPath, input, model }));
        const errors = validateAnalysisResult(result);
        if (errors.length) {
          console.error("[codex-analyzer] 응답 검증 실패:", errors);
          sendJson(res, 502, { error: `Codex CLI 응답 검증 실패: ${errors.join("; ")}` });
          return;
        }

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

async function runCodexAnalyzer({
  repoRoot,
  schemaPath,
  input,
  model
}: {
  repoRoot: string;
  schemaPath: string;
  input: Record<string, unknown>;
  model: string;
}) {
  const runDir = join(tmpdir(), `agent-factory-codex-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(runDir, { recursive: true });
  const outputPath = join(runDir, "analysis-result.json");
  const prompt = buildPrompt(input);

  try {
    const { stdout, stderr } = await runProcess(
      "codex",
      [
        ...codexMcpOverrides,
        "-m",
        model,
        "--cd",
        repoRoot,
        "--sandbox",
        "read-only",
        "--ask-for-approval",
        "never",
        "exec",
        "--ephemeral",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        outputPath,
        "-"
      ],
      prompt,
      180_000
    );

    const outputText = await readFile(outputPath, "utf8").catch(() => stdout);
    try {
      return parseJsonObject(outputText);
    } catch {
      throw new Error(`Codex CLI가 JSON 응답을 반환하지 않았습니다. ${stderr || stdout}`.trim());
    }
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

function buildPrompt(input: Record<string, unknown>): string {
  return [
    "You are the live requirement analyzer for the Agent Factory workbench.",
    "Return only JSON matching schemas/analysis-result.schema.json. No markdown, no commentary.",
    "",
    "Authoritative references - consult these before deciding:",
    "- docs/workbench/taxonomy.md (module_category, *_kind enums, Remote A2A conditions) — read from the working tree.",
    "- docs/workbench/workflow-decision-guide.md (sequential/parallel/loop/human_review/orchestration rules).",
    "- docs/workbench/process-flow.md and docs/visualization/design-system.md (process flow stage, edge, and marker rules).",
    "- adk-docs-mcp — use list_doc_sources/fetch_docs for ADK component facts: Sessions/State/Memory, Callbacks, Artifacts/Events, Apps/Plugins, MCP, A2A, Streaming, Grounding. This is the source of truth for adk_hints; consult it whenever a candidate touches state, guardrails, audit/artifact retention, MCP↔A2A boundary, or live latency.",
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
    "- adk_hints is required on every module candidate. Always emit an object with all five keys (state_memory, callbacks, artifacts_events, mcp_a2a, streaming_grounding); set a key to null when its ADK guidance does not apply, and to a short Korean sentence (grounded in adk-docs-mcp) when it does. Use null for the whole adk_hints object only when no ADK component is relevant at all.",
    "- Do not generate runnable business logic, credentials, private endpoints, deployment scripts, or real banking integration details.",
    "",
    "Taxonomy guardrails:",
    "- Use module_category only from agent, workflow, adapter, remote_a2a.",
    "- Retrieval and Rule Registry are adapter_kind values, not top-level categories.",
    "- Remote A2A is high-friction and requires an independently owned remote agent protocol boundary, not just multiple local steps.",
    "- Unknown facts belong in missing_information, contradictions, assumptions, rationale, or status; do not ask follow-up questions.",
    "",
    "Korean prose for human-visible fields; keep engineering terms in English (Agent, Workflow, Adapter, Remote A2A, module_category, adapter_kind, Session/State, placeholder).",
    "Preserve important rawText terms and make rationales specific enough that a reviewer can explain why each module exists.",
    "",
    "RequirementIntakeInput JSON:",
    JSON.stringify(input, null, 2)
  ].join("\n");
}

function runProcess(command: string, args: string[], input: string, timeoutMs: number) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Codex CLI 분석 시간이 초과되었습니다."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      reject(new Error(`Codex CLI 분석 실패(code ${code ?? "unknown"}): ${stderr || stdout}`.trim()));
    });

    child.stdin.end(input);
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
