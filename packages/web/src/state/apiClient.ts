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
