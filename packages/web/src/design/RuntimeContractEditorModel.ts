import type { RuntimeContract, RuntimeContractStatus } from "../analyzer/types";

type PolicyField = readonly [keyof RuntimeContract["policies"], string];
type RuntimeSupportField = readonly [keyof RuntimeContract["runtime_support"], string];
type OperationBooleanField = readonly [Extract<keyof RuntimeContract["operation"], "callback_expected" | "async_resume_required">, string];

export const POLICY_FIELDS = [
  ["auth_policy", "Auth policy"],
  ["timeout_policy", "Timeout policy"],
  ["retry_policy", "Retry policy"],
  ["fallback_policy", "Fallback policy"],
  ["masking_policy", "Masking policy"],
  ["data_policy", "Data policy"]
] as const satisfies readonly PolicyField[];

export const RUNTIME_SUPPORT_FIELDS = [
  ["context_manager_required", "Context Manager 필요"],
  ["callback_broker_required", "Callback Broker 필요"],
  ["human_approval_required", "Human approval 필요"],
  ["idempotency_required", "Idempotency 필요"],
  ["audit_required", "Audit 필요"],
  ["compensation_required", "Compensation 필요"]
] as const satisfies readonly RuntimeSupportField[];

export const OPERATION_TYPE_OPTIONS = [
  "read",
  "write",
  "approval",
  "batch",
  "notification",
  "unknown"
] as const satisfies readonly RuntimeContract["operation"]["operation_type"][];

export const SIDE_EFFECT_LEVEL_OPTIONS = [
  "none",
  "read_only",
  "write",
  "financial_write",
  "customer_notification",
  "unknown"
] as const satisfies readonly RuntimeContract["operation"]["side_effect_level"][];

export const OPERATION_BOOLEAN_FIELDS = [
  ["callback_expected", "Callback 예상"],
  ["async_resume_required", "Async resume 필요"]
] as const satisfies readonly OperationBooleanField[];

export interface RuntimeContractEditorDraft {
  readonly contract_status: RuntimeContractStatus;
  readonly reviewer_notes: string;
  readonly policies: RuntimeContract["policies"];
  readonly runtime_support: RuntimeContract["runtime_support"];
  readonly operation: RuntimeContract["operation"];
  readonly graph_ir_annotations: RuntimeContract["graph_ir_annotations"];
}

export function createRuntimeContractEditorDraft(contract: RuntimeContract): RuntimeContractEditorDraft {
  return {
    contract_status: contract.contract_status,
    reviewer_notes: contract.reviewer_notes,
    policies: { ...contract.policies },
    runtime_support: { ...contract.runtime_support },
    operation: { ...contract.operation },
    graph_ir_annotations: { ...contract.graph_ir_annotations }
  };
}

export function applyRuntimeContractEditorDraft(
  contract: RuntimeContract,
  draft: RuntimeContractEditorDraft
): RuntimeContract {
  return {
    ...contract,
    contract_status: draft.contract_status,
    reviewer_notes: draft.reviewer_notes,
    policies: { ...draft.policies },
    runtime_support: { ...draft.runtime_support },
    operation: { ...draft.operation },
    graph_ir_annotations: { ...draft.graph_ir_annotations }
  };
}

export function runtimeContractGraphAnnotationKeys(contract: RuntimeContract): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    keys.push(trimmed);
  };

  for (const field of contract.required_review_fields) {
    if (field.startsWith("graph_ir_annotations.")) add(field.slice("graph_ir_annotations.".length));
  }
  for (const key of Object.keys(contract.graph_ir_annotations)) add(key);
  return keys;
}

export function updateRuntimeContractGraphAnnotation(
  annotations: RuntimeContract["graph_ir_annotations"],
  key: string,
  value: string
): RuntimeContract["graph_ir_annotations"] {
  return { ...annotations, [key]: value };
}

export function hasRuntimeContractEditorDraftChanges(
  contract: RuntimeContract,
  draft: RuntimeContractEditorDraft
): boolean {
  return (
    draft.contract_status !== contract.contract_status ||
    draft.reviewer_notes !== contract.reviewer_notes ||
    POLICY_FIELDS.some(([key]) => draft.policies[key] !== contract.policies[key]) ||
    RUNTIME_SUPPORT_FIELDS.some(([key]) => draft.runtime_support[key] !== contract.runtime_support[key]) ||
    OPERATION_BOOLEAN_FIELDS.some(([key]) => draft.operation[key] !== contract.operation[key]) ||
    draft.operation.operation_type !== contract.operation.operation_type ||
    draft.operation.side_effect_level !== contract.operation.side_effect_level ||
    !sameStringRecord(draft.graph_ir_annotations, contract.graph_ir_annotations)
  );
}

export function summarizeRuntimeSupport(support: RuntimeContract["runtime_support"]): string {
  const flags: string[] = [];
  if (support.context_manager_required) flags.push("context_manager");
  if (support.callback_broker_required) flags.push("callback_broker");
  if (support.human_approval_required) flags.push("human_approval");
  if (support.idempotency_required) flags.push("idempotency");
  if (support.audit_required) flags.push("audit");
  if (support.compensation_required) flags.push("compensation");
  return flags.length ? flags.join(", ") : "none";
}

function sameStringRecord(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
}
