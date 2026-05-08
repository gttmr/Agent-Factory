import type { A2AContract } from "../../analyzer/types";

export const NEEDS_INFO_TOKEN = "needs_info";

export const remoteA2ARequiredReviewFields = [
  "owner",
  "agent_card",
  "auth",
  "task_lifecycle",
  "timeout",
  "retry",
  "fallback",
  "audit",
  "data_policy"
];

export function isNeedsInfoValue(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return value.trim() === NEEDS_INFO_TOKEN;
}

export function contractReadinessIssues(contract: A2AContract): string[] {
  const issues: string[] = [];
  if (contract.contract_status === "needs_info") issues.push("contract_status가 정보 필요 상태입니다.");
  const scalarFields: Array<keyof A2AContract> = [
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
  ];
  for (const field of scalarFields) {
    const value = contract[field];
    if (typeof value === "string" && isNeedsInfoValue(value)) issues.push(`${String(field)} 값이 needs_info 입니다.`);
  }
  if (typeof contract.push_notification_policy === "string" && isNeedsInfoValue(contract.push_notification_policy)) {
    issues.push("push_notification_policy 값이 needs_info 입니다.");
  }
  const card = contract.agent_card;
  if (
    isNeedsInfoValue(card.discovery_method) ||
    isNeedsInfoValue(card.agent_card_url) ||
    isNeedsInfoValue(card.version) ||
    isNeedsInfoValue(card.notes)
  ) {
    issues.push("Agent Card discovery/version/notes 중 needs_info 값이 있습니다.");
  }
  if (
    isNeedsInfoValue(contract.task_lifecycle.input_required_followup) ||
    isNeedsInfoValue(contract.task_lifecycle.auth_required_followup)
  ) {
    issues.push("TASK_STATE_INPUT_REQUIRED 또는 TASK_STATE_AUTH_REQUIRED 후속 처리가 needs_info 입니다.");
  }
  if (isNeedsInfoValue(contract.streaming.non_streaming_fallback)) {
    issues.push("non_streaming_fallback 값이 needs_info 입니다.");
  }
  if (
    isNeedsInfoValue(contract.artifact_contract.mutation_rules) ||
    isNeedsInfoValue(contract.artifact_contract.chunking_policy)
  ) {
    issues.push("Artifact contract 값이 needs_info 입니다.");
  }
  if (hasNeedsInfoDeep(contract.supported_interfaces)) issues.push("supported_interfaces 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.input_modes)) issues.push("input_modes 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.output_modes)) issues.push("output_modes 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.security_schemes)) issues.push("security_schemes 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.security_requirements)) issues.push("security_requirements 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.skills)) issues.push("skills 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.operations)) issues.push("operations 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.http_paths)) issues.push("http_paths 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.task_lifecycle.states)) issues.push("task_lifecycle.states 안에 needs_info 값이 있습니다.");
  if (hasNeedsInfoDeep(contract.task_lifecycle.allowed_transitions)) {
    issues.push("task_lifecycle.allowed_transitions 안에 needs_info 값이 있습니다.");
  }
  if (hasNeedsInfoDeep(contract.task_lifecycle.terminal_states)) {
    issues.push("task_lifecycle.terminal_states 안에 needs_info 값이 있습니다.");
  }
  return issues;
}

function hasNeedsInfoDeep(value: unknown): boolean {
  if (isNeedsInfoValue(value as string | null | undefined)) return true;
  if (Array.isArray(value)) return value.some(hasNeedsInfoDeep);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasNeedsInfoDeep);
  }
  return false;
}
