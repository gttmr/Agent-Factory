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
