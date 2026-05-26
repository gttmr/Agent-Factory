import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchApprovals } from "./apiClient";
import type { AfRunManifest } from "../analyzer/afRunManifest";

type ApprovalKey = keyof AfRunManifest["approvals"];

export function useApprovalGate(reqId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ gate, value, etag }: { gate: ApprovalKey; value: boolean; etag: string | null }) => {
      if (!reqId) throw new Error("requirement_id가 없습니다.");
      return await patchApprovals(reqId, { [gate]: value }, etag);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["af", reqId, "manifest"] });
      queryClient.invalidateQueries({ queryKey: ["af", "roots"] });
    }
  });
}

export type { ApprovalKey };
