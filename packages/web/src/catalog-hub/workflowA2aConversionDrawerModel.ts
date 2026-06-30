import { appendCatalogDeltaProposal } from "../catalog/catalogDelta";
import type { CatalogHubEntry } from "../catalog/catalogIndex";
import { buildWorkflowA2aConversionProposal } from "../catalog/workflowA2aConversion";
import type { ArtifactRootSummary } from "../state/apiClient";
import type { RuntimeA2aAgentCardResult } from "../state/useRuntimeA2a";

interface WorkflowA2aActionState {
  readonly visible: boolean;
  readonly disabledReason: string | null;
}

interface AppendWorkflowA2aConversionInput {
  readonly existingCatalogDelta: string;
  readonly entry: CatalogHubEntry;
  readonly providerReqId: string;
  readonly agentCard: RuntimeA2aAgentCardResult;
}

export function getWorkflowA2aActionState(entry: CatalogHubEntry, activeReqId: string): WorkflowA2aActionState {
  if (entry.category !== "workflow") {
    return { visible: false, disabledReason: null };
  }
  if (!activeReqId) {
    return {
      visible: true,
      disabledReason: "활성 artifact root 가 없어 catalog-delta.yaml 제안을 저장할 수 없습니다."
    };
  }
  return { visible: true, disabledReason: null };
}

export function getEligibleA2aProviderRoots(roots: readonly ArtifactRootSummary[]): ArtifactRootSummary[] {
  return roots.filter((root) => root.approvals.stub_ready_for_followup);
}

export function chooseWorkflowA2aProviderReqId(
  entry: CatalogHubEntry,
  providerRoots: readonly ArtifactRootSummary[]
): string {
  const existingProviderReqId = entry.a2a_provider_req_id;
  if (existingProviderReqId && providerRoots.some((root) => root.requirement_id === existingProviderReqId)) {
    return existingProviderReqId;
  }
  return providerRoots[0]?.requirement_id ?? "";
}

export function appendWorkflowA2aConversionProposal(input: AppendWorkflowA2aConversionInput): string {
  const conversion = buildWorkflowA2aConversionProposal(input.entry, input.providerReqId, input.agentCard);
  if (!conversion.ok) {
    throw new Error(conversion.error.message);
  }
  return appendCatalogDeltaProposal(input.existingCatalogDelta, conversion.proposal);
}
