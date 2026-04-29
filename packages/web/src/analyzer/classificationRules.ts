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
    "판단, 요약, 분류, 추천, triage처럼 reasoning responsibility가 있는 단위에 사용합니다.",
  workflow:
    "sequential, parallel, loop, orchestration, human review처럼 결정적이거나 반결정적인 control flow에 사용합니다.",
  adapter:
    "API call, retrieval, managed rules, data query, template, computation, external service처럼 Agent나 Workflow가 호출하는 capability에 사용합니다.",
  remote_a2a:
    "독립 소유 remote agent boundary가 있고 protocol contract, lifecycle, auth, timeout, retry, fallback, audit 세부 정보가 있을 때만 사용합니다."
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
