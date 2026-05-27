import { A2A_CONTRACT_REQUIRED_STRING_FIELDS } from "../analyzer/a2aNormalize";
import type { A2AContract, AnalysisResult, ModuleCandidate } from "../analyzer/types";

const AGENT_CARD_FIELDS = ["discovery_method", "agent_card_url", "version", "notes"] as const;
const ARTIFACT_CONTRACT_FIELDS = ["mutation_rules", "chunking_policy"] as const;

export function a2aContractReadinessIssues(contract: A2AContract | null | undefined): string[] {
  if (!contract) return ["matching A2A contract is missing"];

  const issues: string[] = [];
  if (contract.contract_status !== "approved") {
    issues.push("contract_status must be approved before ADK Runtime Handoff");
  }
  if (isBlank(contract.contract_id)) issues.push("contract_id is missing");
  if (isBlank(contract.remote_module_id)) issues.push("remote_module_id is missing");

  for (const field of A2A_CONTRACT_REQUIRED_STRING_FIELDS) {
    pushStringIssue(issues, field, contract[field]);
  }
  for (const field of AGENT_CARD_FIELDS) {
    pushStringIssue(issues, `agent_card.${field}`, contract.agent_card[field]);
  }

  pushObjectArrayIssues(issues, "supported_interfaces", contract.supported_interfaces, [
    "url",
    "protocol_binding",
    "protocol_version",
    "tenant_policy"
  ]);
  pushStringArrayIssues(issues, "input_modes", contract.input_modes);
  pushStringArrayIssues(issues, "output_modes", contract.output_modes);
  pushObjectArrayIssues(issues, "security_schemes", contract.security_schemes, ["name", "scheme"]);
  pushObjectArrayIssues(issues, "security_requirements", contract.security_requirements, ["scheme_name"]);
  for (const requirement of contract.security_requirements) {
    pushStringArrayIssues(issues, `security_requirements.${requirement.scheme_name || "unknown"}.scopes`, requirement.scopes);
  }
  pushStringArrayIssues(issues, "skills", contract.skills);

  if (contract.message_contract.allowed_part_fields.length === 0) {
    issues.push("message_contract.allowed_part_fields must include at least one reviewed value");
  }
  if (contract.message_contract.allowed_roles.length === 0) {
    issues.push("message_contract.allowed_roles must include at least one reviewed value");
  }

  if (contract.task_lifecycle.states.length === 0) {
    issues.push("task_lifecycle.states must include at least one reviewed value");
  }
  if (contract.task_lifecycle.terminal_states.length === 0) {
    issues.push("task_lifecycle.terminal_states must include at least one reviewed value");
  }
  pushStringIssue(issues, "task_lifecycle.input_required_followup", contract.task_lifecycle.input_required_followup);
  pushStringIssue(issues, "task_lifecycle.auth_required_followup", contract.task_lifecycle.auth_required_followup);

  if (contract.streaming.supported && contract.streaming.wrappers.length === 0) {
    issues.push("streaming.wrappers must include at least one wrapper when streaming is supported");
  }
  pushStringIssue(issues, "streaming.non_streaming_fallback", contract.streaming.non_streaming_fallback);
  pushStringArrayIssues(issues, "operations", contract.operations);
  pushStringArrayIssues(issues, "http_paths", contract.http_paths);
  for (const field of ARTIFACT_CONTRACT_FIELDS) {
    pushStringIssue(issues, `artifact_contract.${field}`, contract.artifact_contract[field]);
  }

  return issues;
}

export function a2aContractsGateReady(analysis: AnalysisResult | null | undefined): boolean {
  if (!analysis) return false;
  const remoteCandidates = remoteA2ACandidates(analysis.moduleCandidates);
  if (remoteCandidates.length === 0) return true;
  return remoteCandidates.every((candidate) => {
    const contract = findMatchingA2AContract(candidate, analysis.a2aContracts ?? []);
    return Boolean(contract) && a2aContractReadinessIssues(contract).length === 0;
  });
}

export function remoteA2ACandidates(candidates: ModuleCandidate[]): ModuleCandidate[] {
  return candidates.filter((candidate) => candidate.module_category === "remote_a2a");
}

export function findMatchingA2AContract(
  candidate: ModuleCandidate,
  contracts: A2AContract[]
): A2AContract | null {
  const byCandidateId = contracts.find((contract) => contract.remote_module_id === candidate.id);
  if (byCandidateId) return byCandidateId;
  if (!candidate.a2a_contract_id) return null;
  return contracts.find((contract) => contract.contract_id === candidate.a2a_contract_id) ?? null;
}

function pushStringIssue(issues: string[], field: string, value: string | null | undefined) {
  if (isBlank(value)) {
    issues.push(`${field} is missing`);
    return;
  }
  if (typeof value === "string" && isNeedsInfo(value)) {
    issues.push(`${field} is still needs_info`);
  }
}

function pushStringArrayIssues(issues: string[], field: string, values: readonly string[]) {
  if (!values.length) {
    issues.push(`${field} must include at least one reviewed value`);
    return;
  }
  if (values.some(isNeedsInfo)) {
    issues.push(`${field} must not contain needs_info`);
  }
}

function pushObjectArrayIssues<T extends Record<string, unknown>>(
  issues: string[],
  field: string,
  values: readonly T[],
  requiredFields: readonly (keyof T & string)[]
) {
  if (!values.length) {
    issues.push(`${field} must include at least one reviewed value`);
    return;
  }
  values.forEach((value, index) => {
    for (const key of requiredFields) {
      const item = value[key];
      if (typeof item !== "string" || isBlank(item)) {
        issues.push(`${field}[${index}].${key} is missing`);
      } else if (isNeedsInfo(item)) {
        issues.push(`${field}[${index}].${key} is still needs_info`);
      }
    }
  });
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isNeedsInfo(value: string): boolean {
  return value.trim() === "needs_info";
}
