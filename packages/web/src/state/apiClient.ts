export interface ArtifactRootSummary {
  requirement_id: string;
  artifact_root: string;
  current_stage: "analyze" | "design" | "build" | "verify";
  approvals: {
    analysis_reviewed: boolean;
    boundaries_approved: boolean;
    runtime_contracts_approved: boolean;
    stub_ready_for_followup: boolean;
  };
  updated_at: string;
}

export interface FetchWithEtagResult<T> {
  data: T;
  etag: string | null;
}

export class AfApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "AfApiError";
  }
}

export type StageRunStage = "analyze" | "design" | "build" | "verify";
export type StageRunStatus = "running" | "completed" | "failed" | "applied" | "canceled";

export interface StageRunRequestBody {
  execution_mode?: "codex" | "fake";
  model: string;
  input?: {
    rawText?: string;
    domain?: string;
  };
  catalog?: unknown[];
  verifyCommand?: string;
  streamProgress?: boolean;
}

export interface StageRunEvent {
  phase: string;
  message: string;
  at?: string;
  elapsedMs?: number;
  title?: string;
  snippet?: string;
  rawEventType?: string;
  itemType?: string;
  status?: string;
  toolName?: string;
  summary?: StageRunSummary;
}

export interface StageRunCodexMetadata {
  backend: "sdk" | "fake";
  thread_id: string | null;
  event_count: number;
  usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
    reasoning_output_tokens: number;
  } | null;
}

export interface StageRunCatalogContext {
  source: "request" | "server_default" | "absent";
  count: number;
  diagnostics: string[];
}

export interface StageRunSummary {
  run_id: string;
  stage: StageRunStage;
  status: StageRunStatus;
  skill_name: string;
  model: string;
  started_at: string;
  finished_at: string | null;
  elapsed_ms: number | null;
  output_artifacts: string[];
  validation: {
    ok: boolean;
    errors: string[];
  };
  last_error: string | null;
  catalog_context?: StageRunCatalogContext;
  codex?: StageRunCodexMetadata;
}

export interface StageRunArtifactDiff {
  path: string;
  proposed_path: string;
  status: "created" | "changed" | "unchanged";
  valid: boolean;
  validation_errors: string[];
  base_etag: string | null;
  proposed_etag: string;
  before_summary: string;
  after_summary: string;
  bytes: number;
}

export interface StageRunDetail {
  request: unknown;
  summary: StageRunSummary;
  diff_summary: {
    files: StageRunArtifactDiff[];
  };
  events: StageRunEvent[];
  proposed_artifacts: Array<{
    path: string;
    canonical_path: string;
    content_type: "application/json" | "text/markdown" | "text/plain";
    preview: string;
    bytes: number;
  }>;
  diagnostics: string | null;
}

async function readResponseError(response: Response, fallback: string): Promise<AfApiError> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: string; details?: unknown };
      return new AfApiError(response.status, body.error ?? fallback, body.details);
    } catch {
      // fall through
    }
  }
  return new AfApiError(response.status, fallback);
}

export async function listArtifactRoots(): Promise<ArtifactRootSummary[]> {
  const response = await fetch("/api/af");
  if (!response.ok) throw await readResponseError(response, "Artifact root 목록을 가져오지 못했습니다.");
  return (await response.json()) as ArtifactRootSummary[];
}

export async function createArtifactRoot(requirementId?: string): Promise<{ requirement_id: string; artifact_root: string }> {
  const response = await fetch("/api/af", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requirementId ? { requirement_id: requirementId } : {})
  });
  if (!response.ok) throw await readResponseError(response, "Artifact root 생성에 실패했습니다.");
  return (await response.json()) as { requirement_id: string; artifact_root: string };
}

export async function fetchManifest(reqId: string): Promise<FetchWithEtagResult<unknown>> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/manifest`);
  if (response.status === 404) throw new AfApiError(404, "manifest 가 존재하지 않습니다.");
  if (!response.ok) throw await readResponseError(response, "manifest 조회에 실패했습니다.");
  return { data: await response.json(), etag: response.headers.get("etag") };
}

export async function patchApprovals(
  reqId: string,
  body: Partial<ArtifactRootSummary["approvals"]>,
  etag: string | null
): Promise<FetchWithEtagResult<unknown>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (etag) headers["If-Match"] = etag;
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/manifest/approvals`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await readResponseError(response, "approval gate 업데이트에 실패했습니다.");
  return { data: await response.json(), etag: response.headers.get("etag") };
}

export async function fetchArtifactJson<T = unknown>(reqId: string, relative: string): Promise<FetchWithEtagResult<T> | null> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/${relative}`);
  if (response.status === 404) return null;
  if (!response.ok) throw await readResponseError(response, `${relative} 조회에 실패했습니다.`);
  return { data: (await response.json()) as T, etag: response.headers.get("etag") };
}

export async function putArtifactJson(
  reqId: string,
  relative: string,
  body: unknown,
  etag: string | null
): Promise<FetchWithEtagResult<{ ok: boolean; bytes: number; etag: string }>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (etag) headers["If-Match"] = etag;
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/${relative}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await readResponseError(response, `${relative} 저장에 실패했습니다.`);
  const data = (await response.json()) as { ok: boolean; bytes: number; etag: string };
  return { data, etag: response.headers.get("etag") ?? data.etag };
}

export async function listStageRuns(reqId: string, stage: StageRunStage): Promise<StageRunSummary[]> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/stages/${stage}/runs`);
  if (!response.ok) throw await readResponseError(response, "stage run 목록 조회에 실패했습니다.");
  return (await response.json()) as StageRunSummary[];
}

export async function fetchStageRun(reqId: string, stage: StageRunStage, runId: string): Promise<StageRunDetail> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/stages/${stage}/runs/${encodeURIComponent(runId)}`);
  if (!response.ok) throw await readResponseError(response, "stage run 상세 조회에 실패했습니다.");
  return (await response.json()) as StageRunDetail;
}

export async function applyStageRun(
  reqId: string,
  stage: StageRunStage,
  runId: string,
  etag?: string | null
): Promise<{
  ok: true;
  applied_artifacts: string[];
  skipped_artifacts: Array<{ path: string; reason: string }>;
}> {
  const headers: Record<string, string> = {};
  if (etag) headers["If-Match"] = etag;
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/stages/${stage}/runs/${encodeURIComponent(runId)}/apply`, {
    method: "POST",
    headers
  });
  if (!response.ok) throw await readResponseError(response, "stage run 적용에 실패했습니다.");
  return (await response.json()) as {
    ok: true;
    applied_artifacts: string[];
    skipped_artifacts: Array<{ path: string; reason: string }>;
  };
}

export async function cancelStageRun(reqId: string, stage: StageRunStage): Promise<{ ok: true; status: "cancel_requested" }> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/stages/${stage}/cancel`, { method: "POST" });
  if (!response.ok) throw await readResponseError(response, "stage run 취소에 실패했습니다.");
  return (await response.json()) as { ok: true; status: "cancel_requested" };
}

export async function streamStageRun(
  reqId: string,
  stage: StageRunStage,
  body: StageRunRequestBody,
  onEvent: (event: StageRunEvent) => void
): Promise<StageRunSummary> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/stages/${stage}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ ...body, streamProgress: true })
  });
  if (!response.ok || !response.body) {
    throw await readResponseError(response, "stage run 실행에 실패했습니다.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let summary: StageRunSummary | null = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const chunk = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      const event = parseStageRunSse(chunk);
      if (event) {
        onEvent(event);
        if (event.summary) summary = event.summary;
      }
      separator = buffer.indexOf("\n\n");
    }
  }
  if (!summary) throw new AfApiError(500, "stage run 종료 summary 를 받지 못했습니다.");
  return summary;
}

function parseStageRunSse(chunk: string): StageRunEvent | null {
  const dataLine = chunk
    .split("\n")
    .find((line) => line.startsWith("data:"));
  if (!dataLine) return null;
  try {
    return JSON.parse(dataLine.slice(5).trim()) as StageRunEvent;
  } catch {
    return null;
  }
}
