import type { CatalogPrefillPayload, MockDraftDetail, MockDraftSummary, MockServerStatus, MockSpec } from "../types/mockSpec";

const API_ROOT = "/api/mock-lab";

export async function listMocks(): Promise<Array<{ mock_id: string; server_name: string; updated_at: string | null }>> {
  return request("");
}

export async function createMock(mockId: string): Promise<{ spec: MockSpec }> {
  return request("", {
    method: "POST",
    body: JSON.stringify({ mock_id: mockId })
  });
}

export async function fetchMockDetail(mockId: string): Promise<{ spec: MockSpec; server_status: MockServerStatus }> {
  return request(`/${encodeURIComponent(mockId)}`);
}

export async function deleteMock(mockId: string): Promise<{ ok: true; mock_id: string }> {
  return request(`/${encodeURIComponent(mockId)}`, { method: "DELETE" });
}

export async function saveMockSpec(mockId: string, spec: MockSpec): Promise<unknown> {
  return request(`/${encodeURIComponent(mockId)}/spec`, {
    method: "PUT",
    body: JSON.stringify(spec)
  });
}

export async function fetchCatalogPrefill(): Promise<CatalogPrefillPayload> {
  return request("/catalog-prefill");
}

export async function draftMockSpec(mockId: string, prompt: string, model: string): Promise<MockDraftSummary> {
  return request(`/${encodeURIComponent(mockId)}/drafts`, {
    method: "POST",
    body: JSON.stringify({ prompt, model })
  });
}

export async function listDrafts(mockId: string): Promise<MockDraftSummary[]> {
  return request(`/${encodeURIComponent(mockId)}/drafts`);
}

export async function readDraft(mockId: string, draftId: string): Promise<MockDraftDetail> {
  return request(`/${encodeURIComponent(mockId)}/drafts/${encodeURIComponent(draftId)}`);
}

export async function cancelDraft(mockId: string, draftId: string): Promise<MockDraftSummary> {
  return request(`/${encodeURIComponent(mockId)}/drafts/${encodeURIComponent(draftId)}/cancel`, { method: "POST" });
}

export async function startServer(mockId: string): Promise<MockServerStatus> {
  return request(`/${encodeURIComponent(mockId)}/server/start`, { method: "POST" });
}

export async function stopServer(mockId: string): Promise<MockServerStatus> {
  return request(`/${encodeURIComponent(mockId)}/server/stop`, { method: "POST" });
}

export async function fetchServerStatus(mockId: string): Promise<MockServerStatus> {
  return request(`/${encodeURIComponent(mockId)}/server/status`);
}

export async function smokeToolsList(mockId: string): Promise<unknown> {
  return request(`/${encodeURIComponent(mockId)}/smoke/tools-list`, { method: "POST" });
}

export async function smokeToolsCall(mockId: string): Promise<unknown> {
  return request(`/${encodeURIComponent(mockId)}/smoke/tools-call`, { method: "POST" });
}

export async function fetchAuditLog(mockId: string): Promise<unknown> {
  return request(`/${encodeURIComponent(mockId)}/audit-log`);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = parsed && typeof parsed.error === "string" ? parsed.error : `Mock Lab API ${response.status}`;
    throw new Error(message);
  }
  return parsed as T;
}
