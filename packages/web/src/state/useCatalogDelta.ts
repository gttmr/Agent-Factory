import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

export interface CatalogDeltaResult {
  content: string;
  etag: string | null;
}

const CATALOG_DELTA_FILE = "catalog-delta.yaml";

export function useCatalogDelta(reqId: string | undefined) {
  return useQuery<CatalogDeltaResult>({
    queryKey: ["af", reqId, CATALOG_DELTA_FILE] as const,
    queryFn: async () => {
      if (!reqId) return { content: "", etag: null };
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/${CATALOG_DELTA_FILE}`);
      if (response.status === 404) return { content: "", etag: null };
      if (!response.ok) throw new AfApiError(response.status, "catalog-delta 조회 실패");
      const content = await response.text();
      return { content, etag: response.headers.get("etag") };
    },
    enabled: Boolean(reqId)
  });
}

export function useSaveCatalogDelta(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, etag }: { content: string; etag: string | null }) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
      if (etag) headers["If-Match"] = etag;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/${CATALOG_DELTA_FILE}`, {
        method: "PUT",
        headers,
        body: content
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({ error: "catalog-delta 저장 실패" }))) as {
          error?: string;
        };
        throw new AfApiError(response.status, body.error ?? "catalog-delta 저장 실패");
      }
      return await response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, CATALOG_DELTA_FILE] })
  });
}
