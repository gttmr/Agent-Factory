import { adapterKinds, agentKinds, remoteContractKinds, workflowKinds } from "../analyzer/types";
import type { AdapterKind, AgentKind, FieldSpec, RemoteContractKind, WorkflowKind } from "../analyzer/types";
import type { CatalogCategory } from "./catalogIndex";
import type { ProposedAddition } from "./catalogDelta";

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

export function buildPublishProposal(proposal: ProposedAddition, selectedSubtype: string): CatalogPublishProposal {
  const request: CatalogPublishProposal = {
    category: proposal.module_category,
    module_category: proposal.module_category,
    name: proposal.name,
    owner_domain: proposal.owner_domain,
    responsibility: proposal.responsibility,
    inputs: proposal.inputs,
    outputs: proposal.outputs,
    composition: proposal.composition,
    notes: proposal.notes ?? proposal.rationale,
    source_candidate_id: proposal.source_candidate_id
  };
  const subtype = getRequiredSubtype(proposal) ?? selectedSubtype;
  if (proposal.module_category === "agent") request.agent_kind = subtype as AgentKind;
  if (proposal.module_category === "workflow") request.workflow_kind = subtype as WorkflowKind;
  if (proposal.module_category === "adapter") request.adapter_kind = subtype as AdapterKind;
  if (proposal.module_category === "remote_a2a") request.remote_contract_kind = subtype as RemoteContractKind;
  return request;
}

export function getRequiredSubtype(proposal: ProposedAddition): string | null {
  if (proposal.module_category === "agent") return proposal.agent_kind ?? null;
  if (proposal.module_category === "workflow") return proposal.workflow_kind ?? null;
  if (proposal.module_category === "adapter") return proposal.adapter_kind ?? null;
  return proposal.remote_contract_kind ?? null;
}

export function subtypeOptions(proposal: ProposedAddition): readonly string[] {
  if (proposal.module_category === "agent") return agentKinds;
  if (proposal.module_category === "workflow") return workflowKinds;
  if (proposal.module_category === "adapter") return adapterKinds;
  return remoteContractKinds;
}
