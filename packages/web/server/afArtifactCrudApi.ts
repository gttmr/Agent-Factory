import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import type { AfRunManifest } from "../src/analyzer/afRunManifest";
import type { AnalysisResult } from "../src/analyzer/types";
import type { ArtifactRootStore } from "./artifactRootStore";
import { ArtifactConflictError, ArtifactValidationError } from "./artifactRootStore";
import { ifMatchHeader, isRecord, readJsonBody, readRawBody, sendJson } from "./httpApi";
import {
  classifyAnalysisChange,
  invalidateApprovalsForAnalysisChange,
  projectApprovalStageStatuses
} from "./runManifestApprovals";
import { assertBuildApprovals } from "./runManifestBuild";
import { collectRuntimeStubFiles } from "./runtimeStubFiles";
import { validateScaffoldPlanWrite } from "./scaffoldPlanValidation";
import { validateAnalysisResult } from "./validators";

export { projectApprovalStageStatuses } from "./runManifestApprovals";

const APPROVAL_KEYS = [
  "analysis_reviewed",
  "boundaries_approved",
  "runtime_contracts_approved",
  "stub_ready_for_followup"
] as const;
type ApprovalKey = (typeof APPROVAL_KEYS)[number];

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
  const bodyKeys = Object.keys(body);
  const unknownKeys = bodyKeys.filter((key) => !isApprovalKey(key));
  if (unknownKeys.length > 0) {
    sendJson(res, 400, { error: `알 수 없는 approval field입니다: ${unknownKeys.join(", ")}` });
    return;
  }
  if (bodyKeys.length === 0) {
    sendJson(res, 400, { error: "변경할 approval field가 필요합니다." });
    return;
  }
  const invalidTypes = bodyKeys.filter((key) => typeof body[key] !== "boolean");
  if (invalidTypes.length > 0) {
    sendJson(res, 400, { error: `approval 값은 boolean이어야 합니다: ${invalidTypes.join(", ")}` });
    return;
  }
  const ifMatch = req.headers["if-match"];
  const { manifest } = await store.readManifest(reqId);
  const requested = body as Partial<Record<ApprovalKey, boolean>>;
  const merged: AfRunManifest["approvals"] = {
    ...manifest.approvals,
    ...requested
  };
  assertApprovalHierarchy(merged, requested);
  if (requested.stub_ready_for_followup === true) await assertRuntimeStubExists(store, reqId);
  const approvals = cascadeApprovalRevocation(merged);
  const next: AfRunManifest = {
    ...manifest,
    approvals,
    stages: projectApprovalStageStatuses(manifest, approvals)
  };
  const written = await store.writeManifest(reqId, next, ifMatchHeader(ifMatch));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, next);
}

function isApprovalKey(value: string): value is ApprovalKey {
  return APPROVAL_KEYS.some((key) => key === value);
}

function assertApprovalHierarchy(
  approvals: AfRunManifest["approvals"],
  requested: Partial<Record<ApprovalKey, boolean>>
): void {
  if (requested.boundaries_approved === true && !approvals.analysis_reviewed) {
    throw new ArtifactValidationError(409, "boundaries_approved=true 전에 analysis_reviewed=true가 필요합니다.");
  }
  if (requested.runtime_contracts_approved === true && !approvals.boundaries_approved) {
    throw new ArtifactValidationError(409, "runtime_contracts_approved=true 전에 boundaries_approved=true가 필요합니다.");
  }
  if (
    requested.stub_ready_for_followup === true &&
    (!approvals.analysis_reviewed || !approvals.boundaries_approved || !approvals.runtime_contracts_approved)
  ) {
    throw new ArtifactValidationError(409, "stub_ready_for_followup=true 전에 Analyze와 Compose 승인이 모두 필요합니다.");
  }
}

function cascadeApprovalRevocation(approvals: AfRunManifest["approvals"]): AfRunManifest["approvals"] {
  if (!approvals.analysis_reviewed) {
    return {
      analysis_reviewed: false,
      boundaries_approved: false,
      runtime_contracts_approved: false,
      stub_ready_for_followup: false
    };
  }
  if (!approvals.boundaries_approved) {
    return { ...approvals, runtime_contracts_approved: false, stub_ready_for_followup: false };
  }
  if (!approvals.runtime_contracts_approved) {
    return { ...approvals, stub_ready_for_followup: false };
  }
  return approvals;
}

async function assertRuntimeStubExists(store: ArtifactRootStore, reqId: string): Promise<void> {
  const stubDir = join(store.resolveRootDir(reqId), "runtime-stub");
  const files = await collectRuntimeStubFiles(stubDir, stubDir).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  if (files.length === 0) {
    throw new ArtifactValidationError(409, "stub_ready_for_followup=true 전에 생성된 runtime-stub 파일이 필요합니다.");
  }
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
  repoRoot: string,
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
    await writeAnalysisResult(store, reqId, body as AnalysisResult, req, res);
    return;
  }
  if (relative === "scaffold-plan.json") {
    await assertBuildApprovals(store, reqId);
    const errors = await validateScaffoldPlanWrite(repoRoot, store, reqId, body);
    if (errors.length > 0) {
      sendJson(res, 422, { error: "scaffold-plan 검증 실패", details: errors });
      return;
    }
  }
  const serialized = `${JSON.stringify(body, null, 2)}\n`;
  const written = await store.writeArtifact(reqId, relative, serialized, ifMatchHeader(req.headers["if-match"]));
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, { ok: true, bytes: written.bytes, etag: written.etag });
}

async function writeAnalysisResult(
  store: ArtifactRootStore,
  reqId: string,
  analysis: AnalysisResult,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const serialized = `${JSON.stringify(analysis, null, 2)}\n`;
  const expectedEtag = ifMatchHeader(req.headers["if-match"]);
  const written = await store.withCanonicalWriteLock(reqId, async () => {
    const current = await store.readArtifact(reqId, "analysis-result.json").catch((error) => {
      if (error instanceof ArtifactValidationError && error.statusCode === 404) return null;
      throw error;
    });
    const actualEtag = current?.etag ?? "0";
    if (expectedEtag && expectedEtag !== actualEtag) {
      throw new ArtifactConflictError(expectedEtag, actualEtag);
    }
    const previous = current ? parseStoredAnalysis(current.content) : null;
    const scope = classifyAnalysisChange(previous, analysis);
    if (scope) {
      const { manifest } = await store.readManifest(reqId);
      await store.writeManifest(reqId, invalidateApprovalsForAnalysisChange(manifest, scope), null);
    }
    return await store.writeArtifact(reqId, "analysis-result.json", serialized, null);
  });
  res.setHeader("ETag", written.etag);
  sendJson(res, 200, { ok: true, bytes: written.bytes, etag: written.etag });
}

function parseStoredAnalysis(content: string): AnalysisResult {
  const value = JSON.parse(content) as unknown;
  const errors = validateAnalysisResult(value);
  if (errors.length) {
    throw new ArtifactValidationError(422, `기존 analysis-result.json 검증 실패: ${errors.join("; ")}`);
  }
  return value as AnalysisResult;
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
