import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CatalogPublishProposal } from "../catalog/catalogPublishProposal";
import { AfApiError } from "./apiClient";

export type { CatalogPublishProposal } from "../catalog/catalogPublishProposal";

export interface CatalogPublishInput {
  reqId: string;
  proposal: CatalogPublishProposal;
}

export interface CatalogPublishResult {
  ok: true;
  id: string;
  name: string;
  version: number;
  file: string;
  already_published?: true;
}

export function useCatalogPublish() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishCatalogEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["af", "catalog-index"] })
  });
}

async function publishCatalogEntry(input: CatalogPublishInput): Promise<CatalogPublishResult> {
  const response = await fetch("/api/catalog/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      req_id: input.reqId,
      proposal: input.proposal
    })
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: "catalog 등록 승인 실패" }))) as {
      error?: string;
      details?: unknown;
    };
    throw new AfApiError(response.status, body.error ?? "catalog 등록 승인 실패", body.details);
  }
  return (await response.json()) as CatalogPublishResult;
}
