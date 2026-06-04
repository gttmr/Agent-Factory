import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyStageRun,
  fetchStageRun,
  listStageRuns,
  streamStageRun,
  type StageRunDetail,
  type StageRunEvent,
  type StageRunRequestBody,
  type StageRunStage,
  type StageRunSummary
} from "./apiClient";

export function useStageRuns(reqId: string | undefined, stage: StageRunStage) {
  return useQuery<StageRunSummary[]>({
    queryKey: ["af", reqId, "stage-runs", stage] as const,
    queryFn: async () => {
      if (!reqId) return [];
      return await listStageRuns(reqId, stage);
    },
    enabled: Boolean(reqId),
    refetchInterval: 5000
  });
}

export function useStageRunDetail(
  reqId: string | undefined,
  stage: StageRunStage,
  runId: string | null,
  options?: { refetchInterval?: number | false }
) {
  return useQuery<StageRunDetail | null>({
    queryKey: ["af", reqId, "stage-runs", stage, runId] as const,
    queryFn: async () => {
      if (!reqId || !runId) return null;
      return await fetchStageRun(reqId, stage, runId);
    },
    enabled: Boolean(reqId && runId),
    refetchInterval: options?.refetchInterval ?? false
  });
}

export function useStartStageRun(
  reqId: string | undefined,
  stage: StageRunStage,
  onEvent: (event: StageRunEvent) => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StageRunRequestBody) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return await streamStageRun(reqId, stage, body, onEvent);
    },
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "stage-runs", stage] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "stage-runs", stage, summary.run_id] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "stage-runs", stage] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] });
    }
  });
}

export function useApplyStageRun(reqId: string | undefined, stage: StageRunStage, etag?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (runId: string) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return await applyStageRun(reqId, stage, runId, etag);
    },
    onSuccess: (_result, runId) => {
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "stage-runs", stage] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "stage-runs", stage, runId] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "analysis-result"] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "boundary-design.md"] });
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] });
    }
  });
}
