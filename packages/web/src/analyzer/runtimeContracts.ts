import type { AnalysisResult, ModuleCandidate, NormalizedRequirement, RuntimeContract } from "./types";

interface RuntimeContractBuildInput {
  normalizedRequirement: NormalizedRequirement;
  moduleCandidates: ModuleCandidate[];
  existingContracts?: RuntimeContract[];
}

export function ensureRuntimeContracts(result: AnalysisResult): AnalysisResult {
  if (!result || typeof result !== "object") return result;
  return {
    ...result,
    runtimeContracts: buildRuntimeContracts({
      normalizedRequirement: result.normalizedRequirement,
      moduleCandidates: result.moduleCandidates,
      existingContracts: Array.isArray(result.runtimeContracts) ? result.runtimeContracts : []
    })
  };
}

export function buildRuntimeContracts({
  normalizedRequirement,
  moduleCandidates,
  existingContracts = []
}: RuntimeContractBuildInput): RuntimeContract[] {
  const existingById = new Map(existingContracts.map((contract) => [contract.contract_id, contract]));
  const next: RuntimeContract[] = [];
  const usedIds = new Set<string>();

  const addContract = (base: RuntimeContract) => {
    const previous = existingById.get(base.contract_id);
    const merged = previous ? mergeRuntimeContract(previous, base) : base;
    usedIds.add(merged.contract_id);
    next.push(merged);
  };

  for (const candidate of moduleCandidates) {
    if (!needsLegacyContract(candidate, normalizedRequirement)) continue;
    addContract(buildLegacyAdapterContract(candidate, normalizedRequirement));

    if (needsAdkCallbackContract(candidate, normalizedRequirement)) {
      addContract(buildAdkCallbackContract(candidate, normalizedRequirement));
    }

    if (needsAsyncRuntimeSupport(candidate, normalizedRequirement)) {
      addContract(buildContextManagerContract(candidate, normalizedRequirement));
      addContract(buildCallbackBrokerContract(candidate, normalizedRequirement));
      addContract(buildAsyncResumeContract(candidate, normalizedRequirement));
    }
  }

  for (const existing of existingContracts) {
    if (!usedIds.has(existing.contract_id) && existing.contract_status !== "rejected") {
      next.push(existing);
    }
  }

  return next;
}

export function runtimeContractReadinessIssues(contract: RuntimeContract): string[] {
  const issues: string[] = [];
  if (contract.contract_status !== "approved") {
    issues.push("contract_status must be approved before ADK Runtime Handoff");
  }
  for (const field of contract.required_review_fields) {
    const value = readRuntimeContractField(contract, field);
    if (value === null || value === undefined || value === "" || value === "needs_info") {
      issues.push(`${field} is still needs_info`);
    }
  }
  if (contract.operation.callback_expected && !contract.runtime_support.callback_broker_required) {
    issues.push("callback_expected requires callback_broker_required");
  }
  if (contract.operation.async_resume_required && !contract.runtime_support.context_manager_required) {
    issues.push("async_resume_required requires context_manager_required");
  }
  if (contract.runtime_support.human_approval_required && !contract.runtime_support.idempotency_required) {
    issues.push("approval-gated work requires idempotency");
  }
  return issues;
}

function mergeRuntimeContract(previous: RuntimeContract, base: RuntimeContract): RuntimeContract {
  return {
    ...base,
    contract_status: previous.contract_status ?? base.contract_status,
    reviewer_notes: previous.reviewer_notes ?? base.reviewer_notes,
    summary: previous.summary || base.summary,
    required_review_fields: previous.required_review_fields?.length
      ? previous.required_review_fields
      : base.required_review_fields,
    runtime_support: { ...base.runtime_support, ...previous.runtime_support },
    operation: { ...base.operation, ...previous.operation },
    identifiers: previous.identifiers?.length ? previous.identifiers : base.identifiers,
    policies: { ...base.policies, ...previous.policies },
    graph_ir_annotations: { ...base.graph_ir_annotations, ...previous.graph_ir_annotations },
    synthetic_examples: previous.synthetic_examples?.length ? previous.synthetic_examples : base.synthetic_examples,
    developer_todos: previous.developer_todos?.length ? previous.developer_todos : base.developer_todos
  };
}

function needsLegacyContract(candidate: ModuleCandidate, requirement: NormalizedRequirement): boolean {
  return (
    candidate.adapter_kind === "legacy_api" ||
    candidate.access_protocol === "mcp" ||
    includesLegacySignal(candidate, requirement)
  );
}

function needsAdkCallbackContract(candidate: ModuleCandidate, requirement: NormalizedRequirement): boolean {
  return (
    needsLegacyContract(candidate, requirement) ||
    Boolean(candidate.adk_hints?.callbacks?.trim()) ||
    candidate.risk_signals.includes("human_approval_required") ||
    candidate.risk_signals.includes("customer_impact")
  );
}

function needsAsyncRuntimeSupport(candidate: ModuleCandidate, requirement: NormalizedRequirement): boolean {
  const text = evidenceText(candidate, requirement);
  return (
    /callback|콜백|async|비동기|job[_ -]?id|resume|재개|대기/i.test(text) ||
    candidate.risk_signals.includes("transaction_write") ||
    candidate.risk_signals.includes("customer_impact")
  );
}

function buildLegacyAdapterContract(candidate: ModuleCandidate, requirement: NormalizedRequirement): RuntimeContract {
  const mcp = candidate.access_protocol === "mcp" || Boolean(candidate.mcp_tool_name);
  const write = isWriteLike(candidate, requirement);
  const async = needsAsyncRuntimeSupport(candidate, requirement);
  return {
    contract_id: runtimeContractId(candidate.id, mcp ? "mcp-legacy" : "eai-legacy"),
    contract_kind: mcp ? "mcp_legacy_adapter" : "eai_legacy_adapter",
    module_id: candidate.id,
    title: `${candidate.name} ${mcp ? "MCP Legacy Adapter" : "EAI Legacy Adapter"}`,
    contract_status: "needs_info",
    summary: `${candidate.name} runtime contract placeholder. 실제 endpoint나 credential 없이 reviewed adapter boundary만 기록한다.`,
    required_review_fields: [
      "policies.auth_policy",
      "policies.timeout_policy",
      "policies.retry_policy",
      "policies.fallback_policy",
      "policies.masking_policy",
      "policies.data_policy"
    ],
    reviewer_notes: "",
    runtime_support: {
      context_manager_required: async,
      callback_broker_required: async,
      human_approval_required: write,
      idempotency_required: write,
      audit_required: true,
      compensation_required: write
    },
    operation: {
      operation_type: write ? "write" : "read",
      side_effect_level: write ? "financial_write" : "read_only",
      callback_expected: async,
      async_resume_required: async
    },
    identifiers: ["work_item_id", "correlation_id", "idempotency_key", "eai_job_id", "legacy_tx_id"],
    policies: defaultPolicies(),
    graph_ir_annotations: async
      ? {
          legacy_submit: "SUBMITTED_TO_EAI",
          callback_wait: "WAITING_LEGACY_CALLBACK",
          resume_condition: "CALLBACK_RECEIVED"
        }
      : {},
    synthetic_examples: [
      {
        input_ref: "synthetic-reviewed-input",
        output_ref: async ? "synthetic-eai-job-id" : "synthetic-safe-summary",
        private_endpoint: false
      }
    ],
    developer_todos: [
      "TODO: Implement EAI client through an approved MCP or adapter contract only.",
      "TODO: Keep raw legacy payloads outside LLM context.",
      "TODO: Add synthetic smoke contract before enabling runtime chat smoke."
    ]
  };
}

function buildContextManagerContract(candidate: ModuleCandidate, _requirement: NormalizedRequirement): RuntimeContract {
  return {
    contract_id: runtimeContractId(candidate.id, "context-manager"),
    contract_kind: "context_manager",
    module_id: candidate.id,
    title: `${candidate.name} Context Manager`,
    contract_status: "needs_info",
    summary: "WorkItem 상태, correlation, callback, approval, retry, timeout, audit 상태를 durable contract로 관리한다.",
    required_review_fields: [
      "policies.auth_policy",
      "policies.timeout_policy",
      "policies.retry_policy",
      "policies.data_policy"
    ],
    reviewer_notes: "",
    runtime_support: {
      context_manager_required: true,
      callback_broker_required: true,
      human_approval_required: true,
      idempotency_required: true,
      audit_required: true,
      compensation_required: true
    },
    operation: {
      operation_type: "approval",
      side_effect_level: "write",
      callback_expected: true,
      async_resume_required: true
    },
    identifiers: ["work_item_id", "agent_session_id", "agent_run_id", "correlation_id", "idempotency_key", "eai_job_id", "legacy_tx_id"],
    policies: defaultPolicies(),
    graph_ir_annotations: {
      approval_wait: "APPROVAL_PENDING",
      callback_wait: "WAITING_LEGACY_CALLBACK",
      resume_requested: "RESUME_REQUESTED",
      manual_review: "MANUAL_REVIEW_REQUIRED",
      compensation: "COMPENSATION_REQUIRED"
    },
    synthetic_examples: [
      {
        work_item_id: "WI-SYNTH-000001",
        status: "WAITING_LEGACY_CALLBACK",
        llm_exposure: "safe_summary_only"
      }
    ],
    developer_todos: [
      "TODO: Implement Context Manager client after approved runtime endpoint is provided.",
      "TODO: Store masked/tokenized references only.",
      "TODO: Map callback and approval state before resuming ADK workflow."
    ]
  };
}

function buildCallbackBrokerContract(candidate: ModuleCandidate, _requirement: NormalizedRequirement): RuntimeContract {
  return {
    contract_id: runtimeContractId(candidate.id, "callback-broker"),
    contract_kind: "callback_broker",
    module_id: candidate.id,
    title: `${candidate.name} Callback Broker`,
    contract_status: "needs_info",
    summary: "EAI/Legacy callback을 agent가 직접 받지 않고 검증, 중복 제거, 상태 전이 요청만 수행한다.",
    required_review_fields: [
      "policies.auth_policy",
      "policies.timeout_policy",
      "policies.fallback_policy",
      "policies.masking_policy",
      "policies.data_policy"
    ],
    reviewer_notes: "",
    runtime_support: {
      context_manager_required: true,
      callback_broker_required: true,
      human_approval_required: false,
      idempotency_required: true,
      audit_required: true,
      compensation_required: true
    },
    operation: {
      operation_type: "notification",
      side_effect_level: "write",
      callback_expected: true,
      async_resume_required: true
    },
    identifiers: ["callback_id", "correlation_id", "work_item_id", "eai_job_id", "legacy_tx_id"],
    policies: defaultPolicies(),
    graph_ir_annotations: {
      callback_received: "CALLBACK_RECEIVED",
      resume_requested: "RESUME_REQUESTED"
    },
    synthetic_examples: [
      {
        callback_id: "cb-synthetic-uuid",
        correlation_id: "corr-synthetic-uuid",
        status: "SUCCESS",
        signature: "synthetic-hmac-or-jwt"
      }
    ],
    developer_todos: [
      "TODO: Verify callback signature and reject replay before state transition.",
      "TODO: Deduplicate callback_id and correlation_id.",
      "TODO: Do not route raw callback payload to LLM."
    ]
  };
}

function buildAdkCallbackContract(candidate: ModuleCandidate, _requirement: NormalizedRequirement): RuntimeContract {
  return {
    contract_id: runtimeContractId(candidate.id, "adk-callback"),
    contract_kind: "adk_callback",
    module_id: candidate.id,
    title: `${candidate.name} ADK Callback`,
    contract_status: "needs_info",
    summary: "ADK before/after callback에서 tool 입력 검증, 승인 확인, masking, audit summary, safe resume를 담당한다.",
    required_review_fields: ["policies.masking_policy", "policies.data_policy"],
    reviewer_notes: "",
    runtime_support: {
      context_manager_required: needsAsyncRuntimeSupport(candidate, _requirement),
      callback_broker_required: false,
      human_approval_required: isWriteLike(candidate, _requirement),
      idempotency_required: isWriteLike(candidate, _requirement),
      audit_required: true,
      compensation_required: isWriteLike(candidate, _requirement)
    },
    operation: {
      operation_type: isWriteLike(candidate, _requirement) ? "approval" : "read",
      side_effect_level: "none",
      callback_expected: false,
      async_resume_required: needsAsyncRuntimeSupport(candidate, _requirement)
    },
    identifiers: ["work_item_id", "correlation_id", "idempotency_key"],
    policies: defaultPolicies(),
    graph_ir_annotations: {
      before_tool_callback: "validate args, approval, idempotency",
      after_tool_callback: "mask response and persist safe state",
      after_agent_callback: "safe summary only"
    },
    synthetic_examples: [
      {
        callback: "before_tool_callback",
        action: "block write when approval token is missing"
      }
    ],
    developer_todos: [
      "TODO: Use exact ADK callback parameter names for the selected ADK version.",
      "TODO: Keep skeleton TODO-only until runtime endpoint and approval contract are reviewed."
    ]
  };
}

function buildAsyncResumeContract(candidate: ModuleCandidate, _requirement: NormalizedRequirement): RuntimeContract {
  return {
    contract_id: runtimeContractId(candidate.id, "async-resume"),
    contract_kind: "async_resume",
    module_id: candidate.id,
    title: `${candidate.name} Async Resume`,
    contract_status: "needs_info",
    summary: "EAI job_id 이후 callback 수신과 RESUME_REQUESTED 상태를 ADK Runtime Handoff가 읽도록 하는 계약이다.",
    required_review_fields: ["policies.timeout_policy", "policies.retry_policy", "policies.fallback_policy"],
    reviewer_notes: "",
    runtime_support: {
      context_manager_required: true,
      callback_broker_required: true,
      human_approval_required: isWriteLike(candidate, _requirement),
      idempotency_required: true,
      audit_required: true,
      compensation_required: isWriteLike(candidate, _requirement)
    },
    operation: {
      operation_type: "batch",
      side_effect_level: isWriteLike(candidate, _requirement) ? "financial_write" : "read_only",
      callback_expected: true,
      async_resume_required: true
    },
    identifiers: ["work_item_id", "correlation_id", "eai_job_id", "legacy_tx_id"],
    policies: defaultPolicies(),
    graph_ir_annotations: {
      legacy_submit_node: "SUBMITTED_TO_EAI",
      callback_wait_node: "WAITING_LEGACY_CALLBACK",
      resume_requested_node: "RESUME_REQUESTED"
    },
    synthetic_examples: [
      {
        graph_node: "wait_legacy_callback",
        context_manager_status: "WAITING_LEGACY_CALLBACK",
        resume_condition: "CALLBACK_RECEIVED"
      }
    ],
    developer_todos: [
      "TODO: Stop the initial agent run with a pending safe summary.",
      "TODO: Resume only after Context Manager records CALLBACK_RECEIVED or RESUME_REQUESTED."
    ]
  };
}

function defaultPolicies(): RuntimeContract["policies"] {
  return {
    auth_policy: "needs_info",
    timeout_policy: "needs_info",
    retry_policy: "needs_info",
    fallback_policy: "needs_info",
    masking_policy: "safe_summary_only",
    data_policy: "synthetic_or_masked_only"
  };
}

function readRuntimeContractField(contract: RuntimeContract, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, contract);
}

function includesLegacySignal(candidate: ModuleCandidate, requirement: NormalizedRequirement): boolean {
  return /eai|legacy|레거시|계정계|코어|core banking|loan legacy|customer legacy|card legacy/i.test(
    evidenceText(candidate, requirement)
  );
}

function isWriteLike(candidate: ModuleCandidate, requirement: NormalizedRequirement): boolean {
  const text = evidenceText(candidate, requirement);
  return (
    /write|change|submit|update|한도 변경|변경|신청|접수|승인|transaction/i.test(text) ||
    candidate.side_effect === "write" ||
    candidate.side_effect === "read_write" ||
    candidate.risk_signals.includes("transaction_write") ||
    candidate.risk_signals.includes("customer_impact") ||
    candidate.risk_signals.includes("human_approval_required")
  );
}

function evidenceText(candidate: ModuleCandidate, requirement: NormalizedRequirement): string {
  return [
    requirement.raw_text,
    requirement.business_goal,
    ...requirement.systems.map((system) => system.name),
    candidate.name,
    candidate.rationale,
    candidate.adk_hints?.callbacks ?? "",
    candidate.adk_hints?.mcp_a2a ?? "",
    ...candidate.missing_information
  ].join(" ");
}

function runtimeContractId(moduleId: string, suffix: string): string {
  return `rtc-${moduleId.replace(/^mod-/, "")}-${suffix}`.replace(/[^a-z0-9-]/g, "-");
}
