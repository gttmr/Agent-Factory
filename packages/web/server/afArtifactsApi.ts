import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ArtifactConflictError,
  ArtifactRootStore,
  ArtifactValidationError,
  REQ_ID_PATTERN
} from "./artifactRootStore";
import {
  type AfRunManifest,
  type AfRunValidationResult,
  afRunValidationResults
} from "../src/analyzer/afRunManifest";
import { validateAnalysisResult } from "./validators";

type MiddlewareNext = (error?: unknown) => void;

const MARKDOWN_PATHS = new Set([
  "analysis-summary.md",
  "boundary-design.md",
  "implementation-handoff.md",
  "validation-report.md"
]);

const JSON_ARTIFACT_PATHS = new Set([
  "analysis-result.json",
  "normalized-requirement.json",
  "module-candidates.json",
  "process-flow.json",
  "commonization-notes.json",
  "a2a-contracts.json",
  "scaffold-plan.json"
]);

const YAML_PATHS = new Set(["catalog-delta.yaml"]);

export function createAfArtifactsMiddleware(repoRoot: string) {
  const store = new ArtifactRootStore({ repoRoot });

  return async function afArtifactsMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: MiddlewareNext
  ): Promise<void> {
    try {
      const url = parsePath(req);
      if (!url) {
        sendJson(res, 404, { error: "경로를 해석할 수 없습니다." });
        return;
      }

      // Collection: /api/af  → mounted as "" by Vite's middlewares.use("/api/af", ...)
      if (url.segments.length === 0) {
        if (req.method === "GET") return await handleListRoots(store, res);
        if (req.method === "POST") return await handleCreateRoot(store, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      const [reqId, ...rest] = url.segments;
      if (!REQ_ID_PATTERN.test(reqId)) {
        sendJson(res, 400, { error: "requirement_id 형식이 올바르지 않습니다." });
        return;
      }

      // /api/af/:id  → manifest summary
      if (rest.length === 0) {
        if (req.method === "GET") return await handleGetSummary(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      const sub = rest.join("/");

      // /api/af/:id/manifest
      if (sub === "manifest") {
        if (req.method === "GET") return await handleGetManifest(store, reqId, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/manifest/approvals
      if (sub === "manifest/approvals") {
        if (req.method === "PATCH") return await handlePatchApprovals(store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // /api/af/:id/manifest/validation
      if (sub === "manifest/validation") {
        if (req.method === "PATCH") return await handlePatchValidation(store, reqId, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // JSON artifacts
      if (JSON_ARTIFACT_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetJson(store, reqId, sub, res);
        if (req.method === "PUT") return await handlePutJson(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // Markdown artifacts
      if (MARKDOWN_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetText(store, reqId, sub, "text/markdown", res);
        if (req.method === "PUT") return await handlePutText(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      // YAML artifacts
      if (YAML_PATHS.has(sub)) {
        if (req.method === "GET") return await handleGetText(store, reqId, sub, "application/yaml", res);
        if (req.method === "PUT") return await handlePutText(store, reqId, sub, req, res);
        sendJson(res, 405, { error: "지원하지 않는 메서드입니다." });
        return;
      }

      sendJson(res, 404, { error: `알 수 없는 아티팩트 경로입니다: ${sub}` });
    } catch (error) {
      handleError(error, res, next);
    }
  };
}

async function handleListRoots(store: ArtifactRootStore, res: ServerResponse): Promise<void> {
  const summaries = await store.listRoots();
  sendJson(res, 200, summaries);
}

async function handleCreateRoot(
  store: ArtifactRootStore,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req).catch(() => ({}));
  const requested = isRecord(body) ? body.requirement_id : undefined;
  const reqId = typeof requested === "string" && requested.trim() ? requested.trim() : await mintRequirementId(store);
  const created = await store.createRoot(reqId);
  sendJson(res, 201, created);
}

async function handleGetSummary(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  res.setHeader("ETag", etag);
  sendJson(res, 200, { manifest, etag });
}

async function handleGetManifest(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  res.setHeader("ETag", etag);
  sendJson(res, 200, manifest);
}

async function handlePatchApprovals(
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    sendJson(res, 400, { error: "본문은 객체여야 합니다." });
    return;
  }
  const ifMatch = req.headers["if-match"];
  const { manifest } = await store.readManifest(reqId);
  const next: AfRunManifest = {
    ...manifest,
    approvals: {
      analysis_reviewed:
        typeof body.analysis_reviewed === "boolean" ? body.analysis_reviewed : manifest.approvals.analysis_reviewed,
      boundaries_approved:
        typeof body.boundaries_approved === "boolean"
          ? body.boundaries_approved
          : manifest.approvals.boundaries_approved,
      runtime_contracts_approved:
        typeof body.runtime_contracts_approved === "boolean"
          ? body.runtime_contracts_approved
          : manifest.approvals.runtime_contracts_approved,
      stub_ready_for_followup:
        typeof body.stub_ready_for_followup === "boolean"
          ? body.stub_ready_for_followup
          : manifest.approvals.stub_ready_for_followup
    }
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

async function handlePatchValidation(
  store: ArtifactRootStore,
  reqId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  if (!isRecord(body)) {
    sendJson(res, 400, { error: "본문은 객체여야 합니다." });
    return;
  }
  const ifMatch = req.headers["if-match"];
  const { manifest } = await store.readManifest(reqId);
  const commands = Array.isArray(body.commands)
    ? body.commands.filter((item): item is string => typeof item === "string")
    : manifest.validation.commands;
  const lastResult =
    typeof body.last_result === "string" && afRunValidationResults.includes(body.last_result as AfRunValidationResult)
      ? (body.last_result as AfRunValidationResult)
      : manifest.validation.last_result;
  const next: AfRunManifest = {
    ...manifest,
    validation: { commands, last_result: lastResult }
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

async function handleGetJson(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  res: ServerResponse
): Promise<void> {
  const result = await store.readArtifact(reqId, relative).catch((error) => {
    if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
    throw error;
  });
  if (!result) {
    sendJson(res, 404, { error: `아티팩트를 찾을 수 없습니다: ${relative}` });
    return;
  }
  res.setHeader("ETag", result.etag);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(result.content);
}

async function handlePutJson(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
  // analysis-result schema check
  if (relative === "analysis-result.json") {
    const errors = validateAnalysisResult(body);
    if (errors.length) {
      sendJson(res, 422, { error: "analysis-result 검증 실패", details: errors });
      return;
    }
  }
  const serialized = `${JSON.stringify(body, null, 2)}\n`;
  const written = await store.writeArtifact(reqId, relative, serialized, ifMatchHeader(req.headers["if-match"]));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, { ok: true, bytes: written.bytes, etag: written.etag });
}

async function handleGetText(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  contentType: string,
  res: ServerResponse
): Promise<void> {
  const result = await store.readArtifact(reqId, relative).catch((error) => {
    if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
    throw error;
  });
  if (!result) {
    sendJson(res, 404, { error: `아티팩트를 찾을 수 없습니다: ${relative}` });
    return;
  }
  res.setHeader("ETag", result.etag);
  res.setHeader("Content-Type", `${contentType}; charset=utf-8`);
  res.statusCode = 200;
  res.end(result.content);
}

async function handlePutText(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const content = await readRawBody(req);
  const written = await store.writeArtifact(reqId, relative, content, ifMatchHeader(req.headers["if-match"]));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, { ok: true, bytes: written.bytes, etag: written.etag });
}

async function mintRequirementId(store: ArtifactRootStore): Promise<string> {
  const existing = await store.listRoots();
  const used = new Set(existing.map((entry) => entry.requirement_id));
  for (let i = 1; i < 10_000; i += 1) {
    const candidate = `req-${String(i).padStart(3, "0")}`;
    if (!used.has(candidate)) return candidate;
  }
  return `req-${Date.now()}`;
}

function parsePath(req: IncomingMessage): { segments: string[] } | null {
  const raw = req.url ?? "";
  const pathname = raw.split("?")[0] ?? "";
  const trimmed = pathname.replace(/^\/+|\/+$/g, "");
  if (!trimmed) return { segments: [] };
  const segments = trimmed.split("/").map((segment) => decodeURIComponent(segment));
  // Reject any segment with a path separator after decoding
  for (const segment of segments) {
    if (segment.includes("/") || segment.includes("\\") || segment === ".." || segment === ".") {
      return null;
    }
  }
  return { segments };
}

function ifMatchHeader(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function handleError(error: unknown, res: ServerResponse, next: MiddlewareNext): void {
  if (error instanceof ArtifactValidationError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }
  if (error instanceof ArtifactConflictError) {
    sendJson(res, 409, {
      error: error.message,
      expected_etag: error.expectedEtag,
      actual_etag: error.actualEtag
    });
    return;
  }
  if (error instanceof SyntaxError) {
    sendJson(res, 400, { error: "요청 JSON을 해석하지 못했습니다." });
    return;
  }
  if (error instanceof Error) {
    console.error("[af-artifacts] 실패:", error);
    sendJson(res, 500, { error: error.message });
    return;
  }
  next(error);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readRawBody(req);
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
