import type { AdapterKind, AgentKind, ModuleCandidate, ModuleCategory, RemoteContractKind, WorkflowKind } from "./types";

export const moduleCategoryLabels: Record<ModuleCategory, string> = {
  agent: "Agent",
  workflow: "Workflow",
  adapter: "Adapter",
  remote_a2a: "Remote A2A"
};

export const adapterKindLabels: Record<AdapterKind, string> = {
  legacy_api: "Legacy API",
  retrieval: "Retrieval",
  rule_registry: "Rule Registry",
  data_query: "Data Query",
  template: "Template",
  computation: "Computation",
  external_service: "External Service",
  unknown: "Unknown"
};

export const agentKindLabels: Record<AgentKind, string> = {
  specialist: "Specialist",
  shared: "Shared"
};

export const workflowKindLabels: Record<WorkflowKind, string> = {
  sequential: "Sequential",
  parallel: "Parallel",
  loop: "Loop",
  human_review: "Human Review",
  orchestration: "Orchestration",
  unknown: "Unknown"
};

export const remoteContractKindLabels: Record<RemoteContractKind, string> = {
  a2a: "A2A",
  unknown: "Unknown"
};

export const classificationRules: Record<ModuleCategory, string> = {
  agent:
    "Use for a reasoning responsibility such as judgment, summarization, classification, recommendation, or triage.",
  workflow:
    "Use for deterministic or semi-deterministic control flow such as sequential, parallel, loop, orchestration, or human review.",
  adapter:
    "Use for any callable capability used by agents or workflows, including API calls, retrieval, managed rules, data queries, templates, computation, or external services.",
  remote_a2a:
    "Use only for an independently owned remote agent boundary with protocol-level contract, lifecycle, auth, timeout, retry, fallback, and audit details."
};

export function getCandidateSubtype(candidate: ModuleCandidate): string | null {
  if (candidate.module_category === "adapter" && candidate.adapter_kind) {
    return adapterKindLabels[candidate.adapter_kind];
  }
  if (candidate.module_category === "agent" && candidate.agent_kind) {
    return agentKindLabels[candidate.agent_kind];
  }
  if (candidate.module_category === "workflow" && candidate.workflow_kind) {
    return workflowKindLabels[candidate.workflow_kind];
  }
  if (candidate.module_category === "remote_a2a" && candidate.remote_contract_kind) {
    return remoteContractKindLabels[candidate.remote_contract_kind];
  }
  return null;
}

export function getCandidateSubtypeValue(candidate: ModuleCandidate): string | null {
  return (
    candidate.adapter_kind ??
    candidate.agent_kind ??
    candidate.workflow_kind ??
    candidate.remote_contract_kind ??
    null
  );
}
