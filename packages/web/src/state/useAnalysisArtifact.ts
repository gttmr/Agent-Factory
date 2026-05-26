import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchArtifactJson, putArtifactJson, type FetchWithEtagResult } from "./apiClient";
import type { AnalysisResult } from "../analyzer/types";

type AnalysisFetchResult = FetchWithEtagResult<AnalysisResult> | null;

export function useAnalysisArtifact(reqId: string | undefined) {
  return useQuery<AnalysisFetchResult>({
    queryKey: ["af", reqId, "analysis-result"] as const,
    queryFn: async () => {
      if (!reqId) return null;
      return await fetchArtifactJson<AnalysisResult>(reqId, "analysis-result.json");
    },
    enabled: Boolean(reqId)
  });
}

export function useSaveAnalysisArtifact(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ analysis, etag }: { analysis: AnalysisResult; etag: string | null }) => {
      if (!reqId) throw new Error("requirement_id가 없습니다.");
      return await putArtifactJson(reqId, "analysis-result.json", analysis, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "analysis-result"] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] });
    }
  });
}
