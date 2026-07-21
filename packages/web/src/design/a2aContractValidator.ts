import { A2A_CONTRACT_REQUIRED_STRING_FIELDS } from "../analyzer/a2aContracts";
import { A2A_RUNTIME_AUTH_MODES, A2A_RUNTIME_FALLBACK_MODES } from "../analyzer/types";
import type { A2AContract, A2ARuntimePolicy, AnalysisResult, AssetCandidate } from "../analyzer/types";

const AGENT_CARD_FIELDS = ["discovery_method", "agent_card_url", "version", "notes"] as const;
const ARTIFACT_CONTRACT_FIELDS = ["mutation_rules", "chunking_policy"] as const;
const A2A_AUTH_ENV_VAR_PATTERN = /^AF_A2A_[A-Z0-9_]+$/;

export function a2aContractReadinessIssues(contract: A2AContract | null | undefined): string[] {
  if (!contract) return ["matching A2A contract is missing"];

  const issues: string[] = [];
  if (contract.contract_status !== "approved") {
    issues.push("contract_status must be approved before ADK Runtime Handoff");
  }
  if (isBlank(contract.contract_id)) issues.push("contract_id is missing");
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
  const securityEntriesRequired = contract.adk_runtime_policy?.auth?.mode !== "none";
  pushObjectArrayIssues(issues, "security_schemes", contract.security_schemes, ["name", "scheme"], securityEntriesRequired);
  pushObjectArrayIssues(issues, "security_requirements", contract.security_requirements, ["scheme_name"], securityEntriesRequired);
  for (const requirement of contract.security_requirements) {
    pushStringArrayIssues(
      issues,
      `security_requirements.${requirement.scheme_name || "unknown"}.scopes`,
      requirement.scopes,
      false
    );
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
  pushRuntimePolicyIssues(issues, contract.adk_runtime_policy);

  return issues;
}

export function a2aContractsGateReady(analysis: AnalysisResult | null | undefined): boolean {
  if (!analysis) return false;
  const a2aAssets = a2aAgentAssets(analysis.assetCandidates);
  if (a2aAssets.length === 0) return true;
  return a2aAssets.every((candidate) => {
    const contract = findMatchingA2AContract(candidate, analysis.a2aContracts ?? []);
    return Boolean(contract) && a2aContractReadinessIssues(contract).length === 0;
  });
}

export function a2aAgentAssets(candidates: AssetCandidate[]): AssetCandidate[] {
  return candidates.filter(
    (candidate) => candidate.asset_type === "agent" && (candidate.binding?.kind === "a2a" || candidate.exposure?.protocol === "a2a")
  );
}

export function findMatchingA2AContract(
  candidate: AssetCandidate,
  contracts: A2AContract[]
): A2AContract | null {
  const byAgentRef = contracts.find((contract) => contract.agent_ref === candidate.asset_id);
  if (byAgentRef) return byAgentRef;
  const contractRef = candidate.binding?.kind === "a2a" ? candidate.binding.contract_ref : candidate.exposure?.contract_ref;
  return contractRef ? contracts.find((contract) => contract.contract_id === contractRef) ?? null : null;
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

function pushStringArrayIssues(issues: string[], field: string, values: readonly string[], requireAtLeastOne = true) {
  if (requireAtLeastOne && !values.length) {
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
  requiredFields: readonly (keyof T & string)[],
  requireAtLeastOne = true
) {
  if (!values.length) {
    if (requireAtLeastOne) {
      issues.push(`${field} must include at least one reviewed value`);
    }
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

function pushRuntimePolicyIssues(issues: string[], policy: A2ARuntimePolicy | null | undefined) {
  if (!policy || typeof policy !== "object") {
    issues.push("adk_runtime_policy is missing");
    return;
  }

  if (policy.timeout_seconds !== null && (!Number.isFinite(policy.timeout_seconds) || policy.timeout_seconds <= 0)) {
    issues.push("adk_runtime_policy.timeout_seconds must be a positive number or null");
  }

  const auth = policy.auth;
  if (!auth || typeof auth !== "object") {
    issues.push("adk_runtime_policy.auth is missing");
  } else {
    if (!A2A_RUNTIME_AUTH_MODES.includes(auth.mode)) {
      issues.push("adk_runtime_policy.auth.mode is invalid");
    }
    if (auth.mode === "bearer_env" || auth.mode === "metadata_env") {
      const envVar = auth.env_var;
      if (typeof envVar !== "string" || !envVar.trim()) {
        issues.push("adk_runtime_policy.auth.env_var is missing");
      } else if (!A2A_AUTH_ENV_VAR_PATTERN.test(envVar)) {
        issues.push("adk_runtime_policy.auth.env_var must start with AF_A2A_ and contain only A-Z, 0-9, _");
      }
    }
    if (auth.mode === "metadata_env" && isBlank(auth.metadata_key)) {
      issues.push("adk_runtime_policy.auth.metadata_key is missing for metadata_env");
    }
  }

  const retry = policy.retry_handoff;
  if (!retry || typeof retry !== "object") {
    issues.push("adk_runtime_policy.retry_handoff is missing");
  } else {
    if (retry.max_attempts !== null && (!Number.isInteger(retry.max_attempts) || retry.max_attempts < 1)) {
      issues.push("adk_runtime_policy.retry_handoff.max_attempts must be a positive integer or null");
    }
    if (retry.backoff_seconds !== null && (!Number.isFinite(retry.backoff_seconds) || retry.backoff_seconds <= 0)) {
      issues.push("adk_runtime_policy.retry_handoff.backoff_seconds must be a positive number or null");
    }
    if (!Array.isArray(retry.retry_on)) {
      issues.push("adk_runtime_policy.retry_handoff.retry_on must be an array");
    } else if (retry.retry_on.some((entry) => typeof entry !== "string" || isBlank(entry) || isNeedsInfo(entry))) {
      issues.push("adk_runtime_policy.retry_handoff.retry_on must not contain blank or needs_info values");
    }
  }

  const fallback = policy.fallback_handoff;
  if (!fallback || typeof fallback !== "object") {
    issues.push("adk_runtime_policy.fallback_handoff is missing");
  } else {
    if (!A2A_RUNTIME_FALLBACK_MODES.includes(fallback.mode)) {
      issues.push("adk_runtime_policy.fallback_handoff.mode is invalid");
    }
    if (fallback.mode !== "none" && isBlank(fallback.message)) {
      issues.push("adk_runtime_policy.fallback_handoff.message is missing");
    }
  }
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isNeedsInfo(value: string): boolean {
  return value.trim() === "needs_info";
}
