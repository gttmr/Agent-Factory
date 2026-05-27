import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AfApiError, fetchArtifactJson, putArtifactJson } from "./apiClient";
import { streamServerEvents, type ProcessStreamEvent } from "./useStreamingProcess";
import type { ScaffoldPlan } from "../analyzer/types";

export function useScaffoldPlan(reqId: string | undefined) {
  return useQuery<ScaffoldPlan | null>({
    queryKey: ["af", reqId, "scaffold-plan"] as const,
    queryFn: async () => {
      if (!reqId) return null;
      const result = await fetchArtifactJson<ScaffoldPlan>(reqId, "scaffold-plan.json");
      return result?.data ?? null;
    },
    enabled: Boolean(reqId)
  });
}

export function useSaveScaffoldPlan(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: ScaffoldPlan) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      return await putArtifactJson(reqId, "scaffold-plan.json", plan, null);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "scaffold-plan"] })
  });
}

export interface RuntimeStubListing {
  exists: boolean;
  files: Array<{ path: string; bytes: number }>;
}

export interface BuildRuntimeStubResult extends RuntimeStubListing {
  ok: boolean;
  exit_code?: number;
  stdout: string;
  stderr: string;
  command: string;
}

export interface BuildRuntimeStubOptions {
  streamProgress?: boolean;
  onEvent?: (event: ProcessStreamEvent) => void;
}

export function useRuntimeStub(reqId: string | undefined) {
  return useQuery<RuntimeStubListing>({
    queryKey: ["af", reqId, "runtime-stub"] as const,
    queryFn: async () => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-stub`);
      if (!response.ok) throw new AfApiError(response.status, "runtime-stub 목록 조회 실패");
      return (await response.json()) as RuntimeStubListing;
    },
    enabled: Boolean(reqId)
  });
}

export function useBuildRuntimeStub(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (options?: BuildRuntimeStubOptions) => {
      if (!reqId) throw new Error("requirement_id 가 없습니다.");
      if (options?.streamProgress) {
        const result = await streamServerEvents<BuildRuntimeStubResult>(
          `/api/af/${encodeURIComponent(reqId)}/runtime-stub/build`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ streamProgress: true })
          },
          options.onEvent
        );
        if (!result.ok) {
          throw new AfApiError(422, "runtime-stub 생성 실패", result);
        }
        return result;
      }
      const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-stub/build`, {
        method: "POST"
      });
      const body = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new AfApiError(response.status, typeof body.error === "string" ? body.error : "runtime-stub 생성 실패", body);
      }
      return body as unknown as BuildRuntimeStubResult;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", reqId, "runtime-stub"] })
  });
}

export async function fetchRuntimeStubFile(reqId: string, relativePath: string): Promise<string> {
  const response = await fetch(`/api/af/${encodeURIComponent(reqId)}/runtime-stub/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`);
  if (!response.ok) throw new AfApiError(response.status, `${relativePath} 조회 실패`);
  return await response.text();
}
