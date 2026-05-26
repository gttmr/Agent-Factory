import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AfApiError } from "./apiClient";

interface TextArtifactResult {
  content: string;
  etag: string | null;
}

export function useTextArtifact(reqId: string | undefined, relative: string) {
  return useQuery<TextArtifactResult | null>({
    queryKey: ["af", reqId, relative] as const,
    queryFn: async () => {
      if (!reqId) return null;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/${relative}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new AfApiError(response.status, `${relative} 조회 실패`);
      const content = await response.text();
      return { content, etag: response.headers.get("etag") };
    },
    enabled: Boolean(reqId)
  });
}

export function useSaveTextArtifact(reqId: string | undefined, relative: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, etag }: { content: string; etag: string | null }) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const headers: Record<string, string> = { "Content-Type": "text/plain; charset=utf-8" };
      if (etag) headers["If-Match"] = etag;
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/${relative}`, {
        method: "PUT",
        headers,
        body: content
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: `${relative} 저장 실패` }));
        throw new AfApiError(response.status, (body as { error?: string }).error ?? `${relative} 저장 실패`);
      }
      return await response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, relative] })
  });
}
