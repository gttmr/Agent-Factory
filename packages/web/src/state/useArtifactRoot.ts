import { useQuery } from "@tanstack/react-query";
import { fetchManifest, listArtifactRoots, type ArtifactRootSummary } from "./apiClient";
import type { AfRunManifest } from "../analyzer/afRunManifest";

export function useArtifactRoot(reqId: string | undefined) {
  return useQuery({
    queryKey: ["af", reqId, "manifest"] as const,
    queryFn: async () => {
      if (!reqId) throw new Error("requirement_id가 없습니다.");
      const result = await fetchManifest(reqId);
      return { manifest: result.data as AfRunManifest, etag: result.etag };
    },
    enabled: Boolean(reqId),
    refetchInterval: 4000
  });
}

export function useArtifactRoots() {
  return useQuery<ArtifactRootSummary[]>({
    queryKey: ["af", "roots"] as const,
    queryFn: listArtifactRoots
  });
}
