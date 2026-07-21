import type { A2AContract, A2ARuntimePolicy, AnalysisResult, AssetCandidate } from "./types";

export const A2A_CANDIDATE_REQUIRED_FIELDS = ["asset_id", "binding", "exposure"] as const;
export const A2A_CONTRACT_REQUIRED_STRING_FIELDS = [
  "contract_id",
  "agent_ref",
  "target_agent_name",
  "target_agent_purpose",
  "adk_host_mapping",
  "timeout",
  "retry",
  "fallback",
  "cancellation",
  "unsupported_operation",
  "get_task_fallback",
  "auth",
  "token_handling",
  "audit",
  "data_policy"
] as const;

export function buildDefaultA2ARuntimePolicy(): A2ARuntimePolicy {
  return {
    timeout_seconds: null,
    auth: { mode: "none", env_var: null, metadata_key: null },
    retry_handoff: { max_attempts: null, backoff_seconds: null, retry_on: [] },
    fallback_handoff: { mode: "none", message: null }
  };
}

export function createA2AContractForCandidate(analysis: AnalysisResult, assetId: string): AnalysisResult {
  const candidate = analysis.assetCandidates.find((entry) => entry.asset_id === assetId);
  if (!candidate || candidate.asset_type !== "agent") return analysis;
  const used = new Set(analysis.a2aContracts.map((contract) => contract.contract_id));
  const contractId = mintNextContractId(used);
  const contract = buildContract(candidate, contractId);
  return {
    ...analysis,
    assetCandidates: analysis.assetCandidates.map((entry) => entry.asset_id === assetId ? {
      ...entry,
      binding: { kind: "a2a", contract_ref: contractId },
      connection: { transport: "http" },
      exposure: { protocol: "a2a", contract_ref: contractId }
    } : entry),
    a2aContracts: [...analysis.a2aContracts, contract]
  };
}

export function mintNextContractId(used: Set<string>): string {
  let index = 1;
  while (used.has(`a2a-${String(index).padStart(3, "0")}`)) index += 1;
  return `a2a-${String(index).padStart(3, "0")}`;
}

export function buildContract(candidate: AssetCandidate, contractId: string): A2AContract {
  return {
    contract_id: contractId,
    agent_ref: candidate.asset_id,
    target_agent_name: candidate.name,
    target_agent_purpose: candidate.rationale,
    contract_status: "needs_info",
    agent_card: { discovery_method: "needs_info", agent_card_url: "needs_info", version: "needs_info", notes: "needs_info" },
    supported_interfaces: [],
    input_modes: ["application/json"],
    output_modes: ["application/json"],
    security_schemes: [],
    security_requirements: [],
    skills: [],
    extensions: [],
    message_contract: { allowed_part_fields: ["text", "data"], allowed_roles: ["ROLE_USER", "ROLE_AGENT"] },
    task_lifecycle: {
      states: ["TASK_STATE_SUBMITTED", "TASK_STATE_WORKING", "TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED", "TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED"],
      allowed_transitions: [],
      terminal_states: ["TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED"],
      input_required_followup: "needs_info",
      auth_required_followup: "needs_info"
    },
    streaming: { supported: false, wrappers: [], non_streaming_fallback: "SendMessage" },
    operations: ["SendMessage", "GetTask", "CancelTask"],
    http_paths: ["/message:send", "/tasks/{id}", "/tasks/{id}:cancel"],
    artifact_contract: { mutation_rules: "needs_info", chunking_policy: "needs_info" },
    adk_host_mapping: "needs_info",
    adk_runtime_policy: buildDefaultA2ARuntimePolicy(),
    timeout: "needs_info",
    retry: "needs_info",
    fallback: "needs_info",
    cancellation: "needs_info",
    unsupported_operation: "needs_info",
    get_task_fallback: "needs_info",
    push_notification_policy: null,
    auth: "needs_info",
    token_handling: "needs_info",
    audit: "needs_info",
    data_policy: "needs_info"
  };
}
