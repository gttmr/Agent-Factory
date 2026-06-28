import type {
  AccessProtocol,
  AdapterKind,
  AgentKind,
  ModuleCandidate,
  ModuleCategory,
  RemoteContractKind,
  RuntimeContractKind,
  WorkflowKind
} from "./types";

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
  orchestration: "Orchestration",
  graph: "Graph",
  dynamic: "Dynamic",
  unknown: "Unknown"
};

export const remoteContractKindLabels: Record<RemoteContractKind, string> = {
  a2a: "A2A",
  unknown: "Unknown"
};

export const accessProtocolLabels: Record<AccessProtocol, string> = {
  local: "Local",
  http_rest: "HTTP REST",
  mcp: "MCP",
  grpc: "gRPC",
  message_queue: "Message Queue",
  unknown: "Unknown"
};

export const runtimeContractKindLabels: Record<RuntimeContractKind, string> = {
  mcp_legacy_adapter: "MCP Legacy Adapter",
  eai_legacy_adapter: "EAI Legacy Adapter",
  context_manager: "Context Manager",
  callback_broker: "Callback Broker",
  adk_callback: "ADK Callback",
  async_resume: "Async Resume"
};

export const classificationRules: Record<ModuleCategory, string> = {
  agent:
    "판단, 요약, 분류, 추천, triage처럼 reasoning responsibility가 있는 단위에 사용합니다.",
  workflow:
    "큰 의미의 Workflow Agent입니다. orchestration, graph, dynamic 중 하나로 분류하고, 순차/병렬/반복/사람 승인 같은 작은 흐름은 Graph IR 노드와 엣지로 표현합니다.",
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
