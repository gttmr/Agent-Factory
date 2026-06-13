import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdapterKind, AgentKind, FieldSpec, RemoteContractKind, WorkflowKind } from "../analyzer/types";
import { AfApiError } from "./apiClient";
import type { CatalogCategory } from "./useCatalog";

export interface CatalogPublishProposal {
  category: CatalogCategory;
  name: string;
  module_category?: CatalogCategory;
  workflow_kind?: WorkflowKind;
  agent_kind?: AgentKind;
  adapter_kind?: AdapterKind;
  remote_contract_kind?: RemoteContractKind;
  owner_domain?: string;
  responsibility?: string;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  notes?: string;
  source_candidate_id?: string;
}

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
