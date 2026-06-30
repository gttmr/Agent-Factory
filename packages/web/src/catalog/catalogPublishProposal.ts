import { adapterKinds, agentKinds, remoteContractKinds, workflowKinds } from "../analyzer/types";
import type { AdapterKind, AgentKind, ComponentSource, FieldSpec, RemoteContractKind, WorkflowKind } from "../analyzer/types";
import type { RuntimeBinding } from "./types";
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
  component_source?: ComponentSource;
  runtime_binding?: RuntimeBinding;
  a2a_provider_req_id?: string;
  responsibility?: string;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  risk_signals?: string[];
  required_before_approval?: string[];
  contract_status?: string;
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
  if (proposal.risk_signals) request.risk_signals = proposal.risk_signals;
  if (proposal.required_before_approval) request.required_before_approval = proposal.required_before_approval;
  if (proposal.contract_status) request.contract_status = proposal.contract_status;
  if (proposal.component_source) request.component_source = proposal.component_source;
  if (proposal.runtime_binding) request.runtime_binding = proposal.runtime_binding;
  if (proposal.a2a_provider_req_id) request.a2a_provider_req_id = proposal.a2a_provider_req_id;
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
