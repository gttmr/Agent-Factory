import type { AnalysisResult, AssetCandidate, NormalizedRequirement, RuntimeContract, RuntimeContractKind } from "./types";

export interface BuildRuntimeContractsInput {
  normalizedRequirement: NormalizedRequirement;
  assetCandidates: AssetCandidate[];
  existingContracts?: RuntimeContract[];
}

export interface RequiredRuntimeContractKey {
  asset_id: string;
  contract_kind: RuntimeContractKind;
}

/** Strict reads do not synthesize persisted contracts. */
export function ensureRuntimeContracts(result: AnalysisResult): AnalysisResult {
  return result;
}

export function buildRuntimeContracts({
  normalizedRequirement,
  assetCandidates,
  existingContracts = []
}: BuildRuntimeContractsInput): RuntimeContract[] {
  const existingByKey = new Map(existingContracts.map((contract) => [`${contract.asset_id ?? "global"}:${contract.contract_kind}`, contract]));
  const generated: RuntimeContract[] = [];
  for (const candidate of assetCandidates) {
    for (const kind of runtimeKinds(candidate, normalizedRequirement)) {
      const existing = existingByKey.get(`${candidate.asset_id}:${kind}`);
      generated.push(existing ?? createRuntimeContract(candidate, kind));
    }
  }
  return generated;
}

export function requiredRuntimeContractKeys({
  normalizedRequirement,
  assetCandidates
}: Pick<BuildRuntimeContractsInput, "normalizedRequirement" | "assetCandidates">): RequiredRuntimeContractKey[] {
  return assetCandidates
    .filter((candidate) => candidate.status === "approved")
    .slice()
    .sort((left, right) => left.asset_id < right.asset_id ? -1 : left.asset_id > right.asset_id ? 1 : 0)
    .flatMap((candidate) => runtimeKinds(candidate, normalizedRequirement).map((contract_kind) => ({
      asset_id: candidate.asset_id,
      contract_kind
    })));
}

export function runtimeContractReadinessIssues(contract: RuntimeContract): string[] {
  const issues = contract.required_review_fields.filter((path) => !reviewFieldResolved(contract, path));
  if (contract.contract_status !== "approved") issues.push(`${contract.contract_id} contract_status가 approved가 아닙니다.`);
  if (!contract.summary.trim()) issues.push(`${contract.contract_id} summary가 비어 있습니다.`);
  if (contract.contract_kind === "async_resume") {
    if (!contract.resume_policy) issues.push(`${contract.contract_id} resume_policy가 구조화되지 않았습니다.`);
    else {
      if (!contract.resume_policy.interrupt_id.trim()) issues.push(`${contract.contract_id} resume_policy.interrupt_id가 비어 있습니다.`);
      if (!Number.isFinite(contract.resume_policy.timeout_seconds) || contract.resume_policy.timeout_seconds <= 0) {
        issues.push(`${contract.contract_id} resume_policy.timeout_seconds는 양수여야 합니다.`);
      }
    }
    if (contract.runtime_support.idempotency_required && !contract.side_effect_guard) {
      issues.push(`${contract.contract_id} side_effect_guard가 구조화되지 않았습니다.`);
    } else if (contract.side_effect_guard) {
      if (!contract.side_effect_guard.tool_ref.trim()) issues.push(`${contract.contract_id} side_effect_guard.tool_ref가 비어 있습니다.`);
      if (!contract.side_effect_guard.idempotency_key_input.trim()) {
        issues.push(`${contract.contract_id} side_effect_guard.idempotency_key_input이 비어 있습니다.`);
      }
    }
  }
  return [...new Set(issues)];
}

function reviewFieldResolved(contract: RuntimeContract, path: string): boolean {
  let current: unknown = contract;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  if (typeof current === "string") return current.trim().length > 0 && current !== "needs_info";
  if (Array.isArray(current)) return current.length > 0;
  return current !== null && current !== undefined;
}

function runtimeKinds(candidate: AssetCandidate, requirement: NormalizedRequirement): RuntimeContractKind[] {
  const kinds = new Set<RuntimeContractKind>();
  if (candidate.binding?.kind === "mcp") kinds.add("mcp_connection");
  if (
    (candidate.connection?.transport === "http" && candidate.binding?.kind !== "a2a") ||
    candidate.binding?.kind === "a2a" ||
    candidate.exposure?.protocol === "a2a"
  ) {
    kinds.add("external_connection");
  }
  if (candidate.risk_signals.includes("human_approval_required") || requirement.risk_signals.includes("human_approval_required")) kinds.add("context_manager");
  if (candidate.side_effect === "write" || candidate.side_effect === "read_write") kinds.add("adk_callback");
  if (candidate.risk_signals.includes("external_message")) {
    kinds.add("callback_broker");
    kinds.add("async_resume");
  }
  return [...kinds];
}

function createRuntimeContract(candidate: AssetCandidate, kind: RuntimeContractKind): RuntimeContract {
  const callback = kind === "callback_broker" || kind === "async_resume";
  const write = candidate.side_effect === "write" || candidate.side_effect === "read_write";
  return {
    contract_id: `runtime-${slug(candidate.asset_id)}-${kind.replace(/_/g, "-")}`,
    contract_kind: kind,
    asset_id: candidate.asset_id,
    title: `${candidate.name} ${kind}`,
    contract_status: "needs_info",
    summary: `${candidate.name}의 ${kind} 실행 경계`,
    required_review_fields: [
      "policies.auth_policy",
      "policies.timeout_policy",
      "policies.retry_policy",
      ...(kind === "async_resume" ? ["resume_policy"] : []),
      ...(kind === "async_resume" && write ? ["side_effect_guard"] : [])
    ],
    reviewer_notes: "",
    runtime_support: {
      context_manager_required: kind === "context_manager" || callback,
      callback_broker_required: kind === "callback_broker",
      human_approval_required: candidate.risk_signals.includes("human_approval_required"),
      idempotency_required: write,
      audit_required: candidate.audit_required === true || write,
      compensation_required: write
    },
    operation: {
      operation_type: write ? "write" : "read",
      side_effect_level: write ? "write" : candidate.side_effect === "read" ? "read_only" : "none",
      callback_expected: callback,
      async_resume_required: kind === "async_resume"
    },
    identifiers: [],
    policies: {
      auth_policy: "needs_info",
      timeout_policy: "needs_info",
      retry_policy: "needs_info",
      fallback_policy: "needs_info",
      masking_policy: "needs_info",
      data_policy: "needs_info"
    },
    ...(kind === "async_resume" ? { resume_policy: null, side_effect_guard: null } : {}),
    graph_ir_annotations: {},
    synthetic_examples: [],
    developer_todos: []
  };
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}
