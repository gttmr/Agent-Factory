import type { IncomingMessage, ServerResponse } from "node:http";
import {
  type AfRunManifest,
  type AfRunValidationResult,
  afRunValidationResults
} from "../src/analyzer/afRunManifest";
import type { ArtifactRootStore } from "./artifactRootStore";
import { ArtifactValidationError } from "./artifactRootStore";
import { ifMatchHeader, isRecord, readJsonBody, readRawBody, sendJson } from "./httpApi";
import { validateAnalysisResult } from "./validators";

export async function handleListRoots(store: ArtifactRootStore, res: ServerResponse): Promise<void> {
  const summaries = await store.listRoots();
  sendJson(res, 200, summaries);
}

export async function handleCreateRoot(
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

export async function handleGetSummary(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  res.setHeader("ETag", etag);
  sendJson(res, 200, { manifest, etag });
}

export async function handleGetManifest(
  store: ArtifactRootStore,
  reqId: string,
  res: ServerResponse
): Promise<void> {
  const { manifest, etag } = await store.readManifest(reqId);
  res.setHeader("ETag", etag);
  sendJson(res, 200, manifest);
}

export async function handlePatchApprovals(
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
  const approvals = {
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
  };
  const next: AfRunManifest = {
    ...manifest,
    approvals,
    stages: {
      ...manifest.stages,
      analyze: {
        ...manifest.stages.analyze,
        status: approvals.analysis_reviewed ? "complete" : manifest.stages.analyze.status
      },
      design: {
        ...manifest.stages.design,
        status:
          approvals.boundaries_approved && approvals.runtime_contracts_approved
            ? "complete"
            : manifest.stages.design.status
      },
      build: {
        ...manifest.stages.build,
        status: approvals.stub_ready_for_followup ? "complete" : manifest.stages.build.status
      }
    }
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

export async function handlePatchValidation(
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
    isAfRunValidationResult(body.last_result)
      ? body.last_result
      : manifest.validation.last_result;
  const next: AfRunManifest = {
    ...manifest,
    validation: { commands, last_result: lastResult }
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

export async function handleGetJson(
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

export async function handlePutJson(
  store: ArtifactRootStore,
  reqId: string,
  relative: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req);
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

export async function handleGetText(
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

export async function handlePutText(
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

function isAfRunValidationResult(value: unknown): value is AfRunValidationResult {
  return typeof value === "string" && afRunValidationResults.some((candidate) => candidate === value);
}
