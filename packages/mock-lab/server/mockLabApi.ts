import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadCatalogPrefill } from "./catalogPrefillLoader";
import { MockGenerationRegistry, readRunDetail } from "./mockRunner";
import { MockProcessRegistry } from "./mockProcessRegistry";
import { MockLabError, MockSpecStore } from "./mockSpecStore";
import { sampleValueFromSchema, validateMockSpec, validateValueAgainstSchema } from "./schemaValidation";
import type { JsonSchema, JsonRpcEnvelope, MockSpec } from "../src/types/mockSpec";
import { createEmptyMockSpec } from "../src/types/mockSpec";

type MiddlewareNext = (error?: unknown) => void;

export function createMockLabMiddleware(repoRoot: string) {
  const store = new MockSpecStore({ repoRoot });
  const registry = new MockProcessRegistry({ repoRoot, store });
  const generationRegistry = new MockGenerationRegistry({ repoRoot, store });

  return async function mockLabMiddleware(req: IncomingMessage, res: ServerResponse, next: MiddlewareNext): Promise<void> {
    try {
      const parsed = parsePath(req);
      if (!parsed) return sendJson(res, 404, { error: "경로를 해석할 수 없습니다." });

      if (parsed.segments.length === 0) {
        if (req.method === "GET") return sendJson(res, 200, await store.listMocks());
        if (req.method === "POST") return await handleCreate(store, req, res);
        return sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      }

      if (parsed.segments[0] === "catalog-prefill") {
        if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        return sendJson(res, 200, await loadCatalogPrefill(repoRoot));
      }

      const [mockId, ...rest] = parsed.segments;
      if (rest.length === 0) {
        if (req.method === "GET") {
          return sendJson(res, 200, {
            spec: await store.readSpec(mockId),
            server_status: await registry.status(mockId)
          });
        }
        if (req.method === "DELETE") {
          await registry.stop(mockId).catch(() => undefined);
          return sendJson(res, 200, await store.deleteMock(mockId));
        }
        return sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
      }

      const sub = rest.join("/");
      if (sub === "spec") {
        if (req.method !== "PUT") return sendJson(res, 405, { error: "PUT 요청만 지원합니다." });
        const body = await readJsonBody(req);
        const validation = validateMockSpec(body);
        if (!validation.ok) return sendJson(res, 422, { error: "mock spec validation failed", validation });
        return sendJson(res, 200, await store.writeSpec(mockId, body));
      }

      if (sub === "generate") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        const body = await readJsonBody(req).catch(() => ({}));
        const summary = await generationRegistry.start({
          mockId,
          model: isRecord(body) ? body.model : undefined
        });
        return sendJson(res, summary.status === "running" ? 202 : 200, summary);
      }

      if (sub === "runs") {
        if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        return sendJson(res, 200, await store.listRuns(mockId));
      }

      if (rest[0] === "runs" && rest[1] && !rest[2]) {
        if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        return sendJson(res, 200, await readRunDetail(store, mockId, rest[1]));
      }

      if (rest[0] === "runs" && rest[1] && rest[2] === "cancel") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        return sendJson(res, 200, await generationRegistry.cancel(mockId, rest[1]));
      }

      if (rest[0] === "runs" && rest[1] && rest[2] === "apply") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        const detail = await readRunDetail(store, mockId, rest[1]);
        if (detail.summary.status !== "completed" || !detail.summary.validation.ok) {
          return sendJson(res, 409, { error: "completed generation run 이 아니어서 apply 할 수 없습니다." });
        }
        return sendJson(res, 200, await store.applyGeneratedFiles(mockId, rest[1]));
      }

      if (sub === "server/start") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        return sendJson(res, 200, await registry.start(mockId));
      }
      if (sub === "server/stop") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        return sendJson(res, 200, await registry.stop(mockId));
      }
      if (sub === "server/status") {
        if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        return sendJson(res, 200, await registry.status(mockId));
      }

      if (sub === "smoke/tools-list") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        return sendJson(res, 200, await smokeToolsList(store, registry, mockId));
      }
      if (sub === "smoke/tools-call") {
        if (req.method !== "POST") return sendJson(res, 405, { error: "POST 요청만 지원합니다." });
        const body = await readJsonBody(req).catch(() => ({}));
        return sendJson(res, 200, await smokeToolsCall(store, registry, mockId, body));
      }
      if (sub === "audit-log") {
        if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });
        const content = await readFile(store.resolveAuditLog(mockId), "utf8").catch(() => "");
        return sendJson(res, 200, {
          entries: content
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line) as unknown)
        });
      }

      return sendJson(res, 404, { error: `알 수 없는 Mock Lab 경로입니다: ${sub}` });
    } catch (error) {
      return handleError(error, res, next);
    }
  };
}

async function handleCreate(store: MockSpecStore, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req).catch(() => ({}));
  const spec = isRecord(body) && isRecord(body.spec) ? body.spec : createEmptyMockSpec(isRecord(body) && typeof body.mock_id === "string" ? body.mock_id : "mock-lab-demo");
  const validation = validateMockSpec(spec);
  if (!validation.ok) return sendJson(res, 422, { error: "mock spec validation failed", validation });
  await store.writeSpec((spec as MockSpec).mock_id, spec);
  sendJson(res, 201, { spec });
}

async function smokeToolsList(store: MockSpecStore, registry: MockProcessRegistry, mockId: string): Promise<unknown> {
  const spec = await store.readSpec(mockId);
  const response = await registry.sendJsonRpc(mockId, "tools/list", {});
  const tools = readTools(response);
  const checks = spec.tools.map((expected) => {
    const actual = tools.find((tool) => tool.name === expected.name);
    return {
      tool_name: expected.name,
      exists: Boolean(actual),
      has_description: typeof actual?.description === "string" && actual.description.length > 0,
      has_input_schema: isRecord(actual?.inputSchema),
      has_output_schema: isRecord(actual?.outputSchema)
    };
  });
  return {
    ok: checks.every((check) => check.exists && check.has_description && check.has_input_schema && check.has_output_schema),
    response,
    checks
  };
}

async function smokeToolsCall(
  store: MockSpecStore,
  registry: MockProcessRegistry,
  mockId: string,
  body: unknown
): Promise<unknown> {
  const spec = await store.readSpec(mockId);
  const requestedToolName = isRecord(body) && typeof body.tool_name === "string" ? body.tool_name : spec.tools[0].name;
  const tool = spec.tools.find((candidate) => candidate.name === requestedToolName) ?? spec.tools[0];
  const args =
    isRecord(body) && isRecord(body.arguments) ? body.arguments : (sampleValueFromSchema(tool.inputSchema) as Record<string, unknown>);
  const inputValidation = validateValueAgainstSchema(args, tool.inputSchema);
  if (!inputValidation.ok) {
    return { ok: false, phase: "input_validation", validation: inputValidation };
  }
  const response = await registry.sendJsonRpc(mockId, "tools/call", { name: tool.name, arguments: args });
  const result = readResult(response);
  const structuredContent = isRecord(result.structuredContent) ? result.structuredContent : null;
  const outputValidation = structuredContent
    ? validateValueAgainstSchema(structuredContent, tool.outputSchema as JsonSchema)
    : { ok: false, errors: [{ path: "$.structuredContent", message: "structuredContent is required" }] };
  const textBlocks = Array.isArray(result.content)
    ? result.content.filter((item): item is { type: string; text: string } => isRecord(item) && item.type === "text" && typeof item.text === "string")
    : [];
  const hasSyntheticMarker =
    structuredContent?.synthetic === true ||
    structuredContent?.source === "agent-factory-mock-lab" ||
    typeof structuredContent?.synthetic_marker === "string" ||
    textBlocks.some(
      (item) =>
        item.text.includes("agent-factory-mock-lab") ||
        item.text.includes("\"synthetic\":true") ||
        item.text.includes("SYNTHETIC")
    );
  const auditText = await readFile(store.resolveAuditLog(mockId), "utf8").catch(() => "");
  const auditRecorded = auditText.includes("tools/call") || auditHasToolCall(auditText, tool.name);
  return {
    ok: Boolean(structuredContent) && outputValidation.ok && textBlocks.length > 0 && hasSyntheticMarker && auditRecorded,
    arguments: args,
    response,
    checks: {
      input_schema_ok: inputValidation.ok,
      structured_content_exists: Boolean(structuredContent),
      output_schema_ok: outputValidation.ok,
      text_content_exists: textBlocks.length > 0,
      synthetic_marker_exists: hasSyntheticMarker,
      audit_log_recorded: auditRecorded
    },
    output_validation: outputValidation
  };
}

function readTools(response: JsonRpcEnvelope): Array<Record<string, unknown>> {
  const result = readResult(response);
  return Array.isArray(result.tools) ? result.tools.filter(isRecord) : [];
}

function readResult(response: JsonRpcEnvelope): Record<string, any> {
  if (response.error) throw new MockLabError(422, response.error.message);
  return isRecord(response.result) ? response.result : {};
}

function auditHasToolCall(auditText: string, toolName: string): boolean {
  return auditText
    .split(/\r?\n/)
    .filter(Boolean)
    .some((line) => {
      try {
        const parsed = JSON.parse(line) as unknown;
        return isRecord(parsed) && parsed.tool_name === toolName && typeof parsed.outcome === "string";
      } catch {
        return false;
      }
    });
}

function parsePath(req: IncomingMessage): { segments: string[] } | null {
  const raw = req.url ?? "";
  const trimmed = (raw.split("?")[0] ?? "").replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { segments: [] };
  const segments = trimmed.split("/").map((segment) => decodeURIComponent(segment));
  if (segments.some((segment) => segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) {
    return null;
  }
  return { segments };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

function handleError(error: unknown, res: ServerResponse, next: MiddlewareNext): void {
  if (error instanceof MockLabError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }
  if (error instanceof SyntaxError) {
    sendJson(res, 400, { error: "요청 JSON을 해석하지 못했습니다." });
    return;
  }
  if (error instanceof Error) {
    console.error("[mock-lab] failure:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
