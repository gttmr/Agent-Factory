import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CodexAnalyzerModel,
  FieldSpec,
  JsonSchema,
  ModuleCandidate,
  ModuleResolutionAnswer,
  ModuleResolutionDraft,
  ModuleSmokeSpec
} from "../src/analyzer/types";

const allowedModels = new Set(["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"]);
const targetArtifacts = new Set([
  "inputs",
  "outputs",
  "runtime_config",
  "catalog_test_double",
  "graph",
  "chat_smoke",
  "developer_todos"
]);
const defaultTimeoutMs = 240_000;

type MiddlewareNext = (error?: unknown) => void;

export function createModuleResolutionMiddleware(repoRoot: string) {
  let isResolving = false;

  return async function moduleResolutionMiddleware(req: IncomingMessage, res: ServerResponse, next: MiddlewareNext) {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "POST 요청만 지원합니다." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const model = isRecord(body) && typeof body.model === "string" ? body.model : "";
      const candidate = isRecord(body) && isRecord(body.candidate) ? body.candidate : null;

      if (!allowedModels.has(model)) {
        sendJson(res, 400, { error: "허용되지 않은 Codex 모델입니다." });
        return;
      }
      if (!candidate || typeof candidate.id !== "string") {
        sendJson(res, 400, { error: "candidate가 필요합니다." });
        return;
      }
      if (isResolving) {
        sendJson(res, 409, { error: "이미 후보 해결 초안 생성이 진행 중입니다. 완료 후 다시 실행하세요." });
        return;
      }

      isResolving = true;
      try {
        const draft = await runResolutionDraft(repoRoot, model as CodexAnalyzerModel, body);
        sendJson(res, 200, { draft });
      } finally {
        isResolving = false;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        sendJson(res, 400, { error: "요청 JSON을 해석하지 못했습니다." });
        return;
      }
      if (error instanceof Error) {
        sendJson(res, 500, { error: error.message });
        return;
      }
      next(error);
    }
  };
}

async function runResolutionDraft(repoRoot: string, model: CodexAnalyzerModel, payload: unknown): Promise<ModuleResolutionDraft> {
  const runDir = join(tmpdir(), `agent-factory-resolution-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(runDir, { recursive: true });
  const outputPath = join(runDir, "module-resolution-draft.json");
  const prompt = buildResolutionPrompt(payload);
  await runProcess(
    "codex",
    [
      "-c",
      "mcp_servers.chrome-devtools.enabled=false",
      "-c",
      "mcp_servers.adk-docs-mcp.enabled=true",
      "-m",
      model,
      "--cd",
      repoRoot,
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "--ephemeral",
      "--output-last-message",
      outputPath,
      "-"
    ],
    prompt,
    defaultTimeoutMs
  );
  const output = await readFile(outputPath, "utf8");
  return normalizeDraft(parseJsonObject(output), payload);
}

function buildResolutionPrompt(payload: unknown): string {
  const compactPayload = JSON.stringify(payload, null, 2);
  return [
    "You are generating a reviewed module resolution draft for the Agent Factory workbench.",
    "Return exactly one JSON object. Do not include markdown fences.",
    "The draft is not automatically applied; a reviewer will inspect schema trees and patch preview before approval.",
    "Use only synthetic fixture data. Do not invent private banking endpoints, credentials, deployment scripts, or real customer data.",
    "For object inputs/outputs, provide JSON Schema details under each FieldSpec.schema so the UI can show expandable object fields.",
    "For chat smoke, provide a sample_user_message, synthetic_inputs, expected_output_shape, expected_event_markers, mock_sources, and ready.",
    "Required JSON shape:",
    JSON.stringify(
      {
        candidate_id: "candidate id",
        summary: "short Korean summary",
        answers: [
          {
            missing_item: "original missing item",
            resolved_value: "reviewable resolved value",
            rationale: "Korean rationale",
            confidence: 0.8,
            target_artifacts: ["inputs", "chat_smoke"],
            status: "draft"
          }
        ],
        input_schema: [{ name: "field_name", type: "object", required: true, schema: { type: "object", properties: {} } }],
        output_schema: [{ name: "field_name", type: "object", required: true, schema: { type: "object", properties: {} } }],
        developer_todos: ["reviewed TODO boundary"],
        graph_patch_notes: ["edge/schema note"],
        smoke_spec: {
          sample_user_message: "Korean or domain-specific sample prompt",
          synthetic_inputs: {},
          expected_output_shape: { type: "object", properties: {} },
          expected_event_markers: ["stubbed_runtime_contract"],
          mock_sources: ["synthetic_fixture"],
          ready: true
        },
        reviewer_note: "Korean reviewer note"
      },
      null,
      2
    ),
    "Context JSON:",
    compactPayload
  ].join("\n\n");
}

function normalizeDraft(value: unknown, payload: unknown): ModuleResolutionDraft {
  const record = isRecord(value) ? value : {};
  const candidate = isRecord(payload) && isRecord(payload.candidate) ? payload.candidate : {};
  const candidateId = stringOr(record.candidate_id, stringOr(candidate.id, "candidate"));
  const smokeSpec = normalizeSmokeSpec(record.smoke_spec);
  return {
    candidate_id: candidateId,
    generated_at: new Date().toISOString(),
    summary: stringOr(record.summary, "정보 필요 항목 해결 초안"),
    answers: normalizeAnswers(record.answers, stringArray(candidate.missing_information)),
    input_schema: normalizeFieldSpecs(record.input_schema, normalizeFieldSpecs(candidate.inputs, [])),
    output_schema: normalizeFieldSpecs(record.output_schema, normalizeFieldSpecs(candidate.outputs, [])),
    developer_todos: stringArray(record.developer_todos),
    graph_patch_notes: stringArray(record.graph_patch_notes),
    smoke_spec: smokeSpec,
    reviewer_note: stringOr(record.reviewer_note, "")
  };
}

function normalizeAnswers(value: unknown, fallbackMissing: string[]): ModuleResolutionAnswer[] {
  const source = Array.isArray(value) ? value : [];
  const answers = source.filter(isRecord).map((answer): ModuleResolutionAnswer => {
    const artifacts = Array.isArray(answer.target_artifacts)
      ? answer.target_artifacts.filter((item): item is ModuleResolutionAnswer["target_artifacts"][number] => {
          return typeof item === "string" && targetArtifacts.has(item);
        })
      : [];
    return {
      missing_item: stringOr(answer.missing_item, "정보 필요 항목"),
      resolved_value: stringOr(answer.resolved_value, ""),
      rationale: stringOr(answer.rationale, ""),
      confidence: numberOr(answer.confidence, 0.5),
      target_artifacts: artifacts.length ? artifacts : ["developer_todos"],
      status: "draft"
    };
  });
  if (answers.length) return answers;
  return fallbackMissing.map((item) => ({
    missing_item: item,
    resolved_value: "",
    rationale: "",
    confidence: 0.5,
    target_artifacts: ["developer_todos"],
    status: "draft"
  }));
}

function normalizeSmokeSpec(value: unknown): ModuleSmokeSpec {
  const record = isRecord(value) ? value : {};
  return {
    sample_user_message: stringOr(record.sample_user_message, "sample complaint for workflow smoke"),
    synthetic_inputs: isRecord(record.synthetic_inputs) ? record.synthetic_inputs : {},
    expected_output_shape: normalizeJsonSchema(record.expected_output_shape),
    expected_event_markers: stringArray(record.expected_event_markers),
    mock_sources: stringArray(record.mock_sources),
    ready: typeof record.ready === "boolean" ? record.ready : false
  };
}

function normalizeFieldSpecs(value: unknown, fallback: FieldSpec[]): FieldSpec[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.filter(isRecord).map((field) => ({
    name: stringOr(field.name, "field"),
    type: stringOr(field.type, "string"),
    required: typeof field.required === "boolean" ? field.required : true,
    schema: isRecord(field.schema) ? normalizeJsonSchema(field.schema) : schemaFromFieldType(stringOr(field.type, "string"))
  }));
}

function schemaFromFieldType(type: string): JsonSchema {
  const normalized = type.trim().toLowerCase();
  if (normalized.includes("array")) return { type: "array", items: { type: "object", properties: {} } };
  if (normalized.includes("object")) return { type: "object", properties: {}, required: [] };
  if (normalized.includes("number")) return { type: "number" };
  if (normalized.includes("boolean")) return { type: "boolean" };
  return { type: "string" };
}

function normalizeJsonSchema(value: unknown): JsonSchema {
  const record = isRecord(value) ? value : {};
  const properties = isRecord(record.properties)
    ? Object.fromEntries(Object.entries(record.properties).map(([key, nested]) => [key, normalizeJsonSchema(nested)]))
    : undefined;
  const items = isRecord(record.items) ? normalizeJsonSchema(record.items) : undefined;
  return {
    type: typeof record.type === "string" ? record.type : "object",
    description: typeof record.description === "string" ? record.description : undefined,
    properties,
    items,
    required: stringArray(record.required),
    enum: Array.isArray(record.enum) ? record.enum.filter((item) => ["string", "number", "boolean"].includes(typeof item) || item === null) : undefined,
    additionalProperties:
      typeof record.additionalProperties === "boolean"
        ? record.additionalProperties
        : isRecord(record.additionalProperties)
          ? normalizeJsonSchema(record.additionalProperties)
          : undefined
  };
}

function runProcess(command: string, args: string[], input: string, timeoutMs: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stderrChunks: Buffer[] = [];
    const stdoutChunks: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`후보 해결 초안 생성 시간이 초과되었습니다. 제한 ${Math.round(timeoutMs / 1000)}초`));
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolvePromise();
        return;
      }
      const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
      const stdout = Buffer.concat(stdoutChunks).toString("utf8").trim();
      reject(new Error(`후보 해결 초안 생성 실패(code ${code ?? "unknown"}): ${stderr || stdout || "no output"}`));
    });
    child.stdin.end(input);
  });
}

function parseJsonObject(value: string): unknown {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("후보 해결 초안 JSON을 찾지 못했습니다.");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolvePromise({});
        return;
      }
      try {
        resolvePromise(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
