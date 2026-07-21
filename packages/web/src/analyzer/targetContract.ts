import {
  A2A_CONTRACT_STATUSES,
  A2A_HTTP_PATHS,
  A2A_OPERATION_NAMES,
  A2A_PART_FIELDS,
  A2A_ROLES,
  A2A_STREAM_WRAPPERS,
  A2A_TASK_STATES,
  RUNTIME_CONTRACT_KINDS,
  RUNTIME_CONTRACT_STATUSES,
  TARGET_CONTRACT_VERSION,
  assetTypes,
  bindingKinds,
  domainScopes,
  functionRoles,
  graphChannels,
  graphControlKinds,
  graphNodeKinds,
  graphRegionKinds,
  reuseStatuses,
  riskSignals,
  transportKinds,
  workflowCoordinations,
  workflowRepresentations,
  type AnalysisResult,
  type AssetCandidate,
  type AssetType,
  type GraphIR
} from "./types";

export const A2A_CONTRACT_ID_PATTERN = /^a2a(?:-\d{3,}|\.[a-z0-9]+(?:[.-][a-z0-9]+)*)$/;

const TOP_LEVEL_KEYS = [
  "contract_version",
  "normalizedRequirement",
  "evidence",
  "assetCandidates",
  "a2aContracts",
  "runtimeContracts",
  "graph"
] as const;

const CANDIDATE_KEYS = [
  "asset_id",
  "source_requirement_id",
  "catalog_entry_id",
  "name",
  "asset_type",
  "domain_scope",
  "business_domains",
  "owner",
  "reuse_status",
  "capability_tags",
  "binding",
  "connection",
  "workflow_profile",
  "exposure",
  "confidence",
  "rationale",
  "adk_hints",
  "inputs",
  "outputs",
  "risk_level",
  "risk_signals",
  "status",
  "missing_information",
  "missing_information_resolution",
  "resolved_missing_information",
  "resolution_draft",
  "resolution_applied_at",
  "schema_review_state",
  "smoke_spec",
  "side_effect",
  "auth_required",
  "audit_required",
  "citation_required",
  "grounding_required",
  "source_acl_required",
  "versioned",
  "effective_date_required",
  "developer_todos"
] as const;

const REQUIRED_CANDIDATE_KEYS = [
  "asset_id",
  "source_requirement_id",
  "catalog_entry_id",
  "name",
  "asset_type",
  "domain_scope",
  "business_domains",
  "owner",
  "reuse_status",
  "capability_tags",
  "binding",
  "connection",
  "workflow_profile",
  "exposure",
  "confidence",
  "rationale",
  "inputs",
  "outputs",
  "risk_level",
  "risk_signals",
  "status",
  "missing_information"
] as const;

const NORMALIZED_REQUIREMENT_KEYS = [
  "id",
  "title",
  "raw_text",
  "domain",
  "requester",
  "business_goal",
  "current_process",
  "inputs",
  "outputs",
  "systems",
  "risk_signals",
  "missing_information",
  "contradictions",
  "status"
] as const;

const EVIDENCE_KEYS = [
  "requested_goal",
  "business_domain_hint",
  "user_role",
  "input_data",
  "output_data",
  "systems_mentioned",
  "decisions_implied",
  "risk_signals",
  "missing_information",
  "contradictions",
  "assumptions",
  "accepted_missing_information"
] as const;

const A2A_KEYS = [
  "contract_id",
  "agent_ref",
  "target_agent_name",
  "target_agent_purpose",
  "contract_status",
  "agent_card",
  "supported_interfaces",
  "input_modes",
  "output_modes",
  "security_schemes",
  "security_requirements",
  "skills",
  "extensions",
  "message_contract",
  "task_lifecycle",
  "streaming",
  "operations",
  "http_paths",
  "artifact_contract",
  "adk_host_mapping",
  "adk_runtime_policy",
  "timeout",
  "retry",
  "fallback",
  "cancellation",
  "unsupported_operation",
  "get_task_fallback",
  "push_notification_policy",
  "auth",
  "token_handling",
  "audit",
  "data_policy"
] as const;

const RUNTIME_KEYS = [
  "contract_id",
  "contract_kind",
  "asset_id",
  "title",
  "contract_status",
  "summary",
  "required_review_fields",
  "reviewer_notes",
  "runtime_support",
  "operation",
  "identifiers",
  "policies",
  "resume_policy",
  "side_effect_guard",
  "graph_ir_annotations",
  "synthetic_examples",
  "developer_todos"
] as const;
const RUNTIME_REQUIRED_KEYS = RUNTIME_KEYS.filter(
  (key) => key !== "resume_policy" && key !== "side_effect_guard"
);

const asSet = <T extends readonly string[]>(values: T): ReadonlySet<string> => new Set(values);
const ASSET_TYPES = asSet(assetTypes);
const DOMAIN_SCOPES = asSet(domainScopes);
const REUSE_STATUSES = asSet(reuseStatuses);
const BINDING_KINDS = asSet(bindingKinds);
const TRANSPORT_KINDS = asSet(transportKinds);
const WORKFLOW_REPRESENTATIONS = asSet(workflowRepresentations);
const WORKFLOW_COORDINATIONS = asSet(workflowCoordinations);
const NODE_KINDS = asSet(graphNodeKinds);
const CONTROL_KINDS = asSet(graphControlKinds);
const CHANNELS = asSet(graphChannels);
const REGION_KINDS = asSet(graphRegionKinds);
const FUNCTION_ROLES = asSet(functionRoles);
const RISK_SIGNALS = asSet(riskSignals);
const RUNTIME_KINDS = asSet(RUNTIME_CONTRACT_KINDS);
const RUNTIME_STATUSES = asSet(RUNTIME_CONTRACT_STATUSES);

export function validateTargetAnalysisResult(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["AnalysisResult 객체가 필요합니다."];
  exactKeys(value, TOP_LEVEL_KEYS, TOP_LEVEL_KEYS, "AnalysisResult", errors);
  if (value.contract_version !== TARGET_CONTRACT_VERSION) {
    errors.push(`contract_version은 정확히 ${TARGET_CONTRACT_VERSION}이어야 합니다.`);
  }

  validateNormalizedRequirement(value.normalizedRequirement, errors);
  validateEvidence(value.evidence, errors);

  const normalizedRequirementId = isRecord(value.normalizedRequirement) && typeof value.normalizedRequirement.id === "string"
    ? value.normalizedRequirement.id
    : null;
  const candidates = validateCandidates(value.assetCandidates, normalizedRequirementId, errors);
  const contracts = validateA2AContracts(value.a2aContracts, errors);
  validateRuntimeContracts(value.runtimeContracts, candidates, errors);
  validateGraph(value.graph, candidates, normalizedRequirementId, errors);
  validateAsyncResumeGraphReferences(value.runtimeContracts, value.graph, errors);
  validateA2AReferences(candidates, contracts, errors);
  return errors;
}

function validateAsyncResumeGraphReferences(value: unknown, graphValue: unknown, errors: string[]) {
  if (!Array.isArray(value) || !isRecord(graphValue) || !Array.isArray(graphValue.nodes)) return;
  const nodes = new Map(
    graphValue.nodes.filter(isRecord).map((node) => [typeof node.id === "string" ? node.id : "", node])
  );
  const interruptOwners = new Map<string, string>();
  value.forEach((contract, index) => {
    if (!isRecord(contract) || contract.contract_kind !== "async_resume") return;
    const path = `runtimeContracts[${index}]`;
    const annotations = isRecord(contract.graph_ir_annotations) ? contract.graph_ir_annotations : {};
    const support = isRecord(contract.runtime_support) ? contract.runtime_support : {};
    if (support.human_approval_required === true) {
      const humanNodeId = annotations.human_input_node_id;
      const humanNode = typeof humanNodeId === "string" ? nodes.get(humanNodeId) : undefined;
      if (!humanNode || humanNode.node_kind !== "human_input") {
        errors.push(`${path}.graph_ir_annotations.human_input_node_id는 존재하는 Human Input Node를 가리켜야 합니다.`);
      }
    }
    if (isRecord(contract.side_effect_guard)) {
      const toolNodeId = annotations.side_effect_tool_node_id;
      const toolNode = typeof toolNodeId === "string" ? nodes.get(toolNodeId) : undefined;
      if (!toolNode || toolNode.node_kind !== "tool" || toolNode.tool_ref !== contract.side_effect_guard.tool_ref) {
        errors.push(`${path}.graph_ir_annotations.side_effect_tool_node_id는 side_effect_guard.tool_ref와 연결된 Tool Node를 가리켜야 합니다.`);
      }
    }
    const policy = isRecord(contract.resume_policy) ? contract.resume_policy : null;
    if (contract.contract_status === "approved" && policy && typeof policy.interrupt_id === "string") {
      const previous = interruptOwners.get(policy.interrupt_id);
      if (previous) errors.push(`${path}.resume_policy.interrupt_id ${policy.interrupt_id}가 ${previous}와 중복됩니다.`);
      else interruptOwners.set(policy.interrupt_id, path);
    }
  });
}

export function assertTargetAnalysisResult(value: unknown, label = "analysis-result.json"): asserts value is AnalysisResult {
  const errors = validateTargetAnalysisResult(value);
  if (errors.length) throw new Error(`${label} Target Contract 검증 실패: ${errors.join(" ")}`);
}

export function candidateSemanticReadinessIssues(candidate: unknown): string[] {
  if (!isRecord(candidate)) return ["candidate 객체가 필요합니다."];
  const issues: string[] = [];
  if (isRecord(candidate.binding) && candidate.binding.kind === "unresolved") {
    issues.push("binding.kind가 unresolved입니다.");
  }
  if (isRecord(candidate.connection) && candidate.connection.transport === "unknown") {
    issues.push("connection.transport가 unknown입니다.");
  }
  if (isRecord(candidate.workflow_profile) && candidate.workflow_profile.representation === "unresolved") {
    issues.push("workflow_profile.representation이 unresolved입니다.");
  }
  const resolved = new Set(
    Array.isArray(candidate.resolved_missing_information)
      ? candidate.resolved_missing_information.filter((item): item is string => typeof item === "string")
      : []
  );
  const unresolvedMissing = Array.isArray(candidate.missing_information)
    ? candidate.missing_information.filter((item): item is string => typeof item === "string" && !resolved.has(item))
    : [];
  if (unresolvedMissing.length) {
    issues.push(`missing_information이 해결되지 않았습니다: ${unresolvedMissing.join(", ")}`);
  }
  return issues;
}

export function graphOwnershipReadinessIssues(graph: unknown): string[] {
  if (!isRecord(graph) || graph.workflow_ref !== null) return [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.filter(isRecord) : [];
  const privateOrControlKinds = new Set(["function", "human_input", "subworkflow", "join"]);
  const privateOrControlNodes = nodes.filter((node) => privateOrControlKinds.has(String(node.node_kind)));
  const explicitExecutionNodes = nodes.filter((node) =>
    ["agent", "tool", "function", "human_input", "subworkflow"].includes(String(node.node_kind))
  );
  const regionCount = Array.isArray(graph.regions) ? graph.regions.length : 0;
  const reasons: string[] = [];
  if (privateOrControlNodes.length) {
    reasons.push(`private/control Node ${privateOrControlNodes.map((node) => String(node.id)).join(", ")}`);
  }
  if (regionCount) reasons.push(`Region ${regionCount}개`);
  if (explicitExecutionNodes.length > 1) reasons.push(`explicit execution Node ${explicitExecutionNodes.length}개`);
  return reasons.length
    ? [`graph.workflow_ref가 null인 standalone Graph에 ${reasons.join("; ")}가 있어 owning approved Workflow가 필요합니다.`]
    : [];
}

export function approvedGraphReferenceIssues(assets: readonly AssetCandidate[], graph: GraphIR): string[] {
  const approvedById = new Map(
    assets.filter((asset) => asset.status === "approved").map((asset) => [asset.asset_id, asset] as const)
  );
  const issues: string[] = [];
  const requireApproved = (assetId: string, assetType: AssetType, path: string) => {
    const asset = approvedById.get(assetId);
    if (asset?.asset_type !== assetType) {
      issues.push(`${path} ${assetId}는 approved ${assetType} Asset을 가리켜야 합니다.`);
    }
  };
  if (graph.workflow_ref !== null) requireApproved(graph.workflow_ref, "workflow", "graph.workflow_ref");
  graph.nodes.forEach((node, index) => {
    const path = `graph.nodes[${index}]`;
    if (node.node_kind === "agent") {
      requireApproved(node.agent_ref, "agent", `${path}.agent_ref`);
      node.available_tools.forEach((tool, toolIndex) =>
        requireApproved(tool.tool_ref, "tool", `${path}.available_tools[${toolIndex}].tool_ref`)
      );
    } else if (node.node_kind === "tool") {
      requireApproved(node.tool_ref, "tool", `${path}.tool_ref`);
    } else if (node.node_kind === "subworkflow") {
      requireApproved(node.workflow_ref, "workflow", `${path}.workflow_ref`);
    }
  });
  return issues;
}

function validateNormalizedRequirement(value: unknown, errors: string[]) {
  const path = "normalizedRequirement";
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  exactKeys(value, NORMALIZED_REQUIREMENT_KEYS, NORMALIZED_REQUIREMENT_KEYS, path, errors);
  for (const key of ["id", "title", "raw_text", "domain", "business_goal"] as const) nonEmptyString(value[key], `${path}.${key}`, errors);
  if (!isRecord(value.requester)) errors.push(`${path}.requester 객체가 필요합니다.`);
  else {
    exactKeys(value.requester, ["team", "role"], ["team", "role"], `${path}.requester`, errors);
    nonEmptyString(value.requester.team, `${path}.requester.team`, errors);
    nonEmptyString(value.requester.role, `${path}.requester.role`, errors);
  }
  stringArray(value.current_process, `${path}.current_process`, errors);
  fieldArray(value.inputs, `${path}.inputs`, errors);
  fieldArray(value.outputs, `${path}.outputs`, errors);
  if (!Array.isArray(value.systems)) errors.push(`${path}.systems 배열이 필요합니다.`);
  else value.systems.forEach((system, index) => {
    if (!isRecord(system)) errors.push(`${path}.systems[${index}] 객체가 필요합니다.`);
    else {
      exactKeys(system, ["name", "access"], ["name", "access"], `${path}.systems[${index}]`, errors);
      nonEmptyString(system.name, `${path}.systems[${index}].name`, errors);
      enumValue(system.access, new Set(["unknown", "read", "write", "read_write", "not_required"]), `${path}.systems[${index}].access`, errors);
    }
  });
  enumArray(value.risk_signals, RISK_SIGNALS, `${path}.risk_signals`, errors);
  stringArray(value.missing_information, `${path}.missing_information`, errors);
  stringArray(value.contradictions, `${path}.contradictions`, errors);
  enumValue(value.status, new Set(["draft", "reviewed", "approved", "rejected"]), `${path}.status`, errors);
}

function validateEvidence(value: unknown, errors: string[]) {
  const path = "evidence";
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  exactKeys(value, EVIDENCE_KEYS, EVIDENCE_KEYS.filter((key) => key !== "accepted_missing_information"), path, errors);
  for (const key of ["requested_goal", "business_domain_hint", "user_role"] as const) nonEmptyString(value[key], `${path}.${key}`, errors);
  for (const key of ["input_data", "output_data", "systems_mentioned", "decisions_implied", "missing_information", "contradictions", "assumptions"] as const) {
    stringArray(value[key], `${path}.${key}`, errors);
  }
  enumArray(value.risk_signals, RISK_SIGNALS, `${path}.risk_signals`, errors);
  if (value.accepted_missing_information !== undefined) stringArray(value.accepted_missing_information, `${path}.accepted_missing_information`, errors);
}

function validateCandidates(
  value: unknown,
  normalizedRequirementId: string | null,
  errors: string[]
): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value)) {
    errors.push("assetCandidates 배열이 필요합니다.");
    return byId;
  }
  value.forEach((candidate, index) => {
    const path = `assetCandidates[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${path} 객체가 필요합니다.`);
      return;
    }
    exactKeys(candidate, CANDIDATE_KEYS, REQUIRED_CANDIDATE_KEYS, path, errors);
    nonEmptyString(candidate.asset_id, `${path}.asset_id`, errors);
    nonEmptyString(candidate.source_requirement_id, `${path}.source_requirement_id`, errors);
    if (normalizedRequirementId !== null && candidate.source_requirement_id !== normalizedRequirementId) {
      errors.push(`${path}.source_requirement_id는 normalizedRequirement.id와 일치해야 합니다.`);
    }
    nullableString(candidate.catalog_entry_id, `${path}.catalog_entry_id`, errors);
    nonEmptyString(candidate.name, `${path}.name`, errors);
    enumValue(candidate.asset_type, ASSET_TYPES, `${path}.asset_type`, errors);
    enumValue(candidate.domain_scope, DOMAIN_SCOPES, `${path}.domain_scope`, errors);
    stringArray(candidate.business_domains, `${path}.business_domains`, errors);
    nonEmptyString(candidate.owner, `${path}.owner`, errors);
    enumValue(candidate.reuse_status, REUSE_STATUSES, `${path}.reuse_status`, errors);
    stringArray(candidate.capability_tags, `${path}.capability_tags`, errors);
    validateBindingAndConnection(candidate, path, errors);
    validateWorkflowProfile(candidate, path, errors);
    validateExposure(candidate, path, errors);
    if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) errors.push(`${path}.confidence는 0~1 숫자여야 합니다.`);
    nonEmptyString(candidate.rationale, `${path}.rationale`, errors);
    fieldArray(candidate.inputs, `${path}.inputs`, errors);
    fieldArray(candidate.outputs, `${path}.outputs`, errors);
    enumValue(candidate.risk_level, new Set(["low", "medium", "high"]), `${path}.risk_level`, errors);
    enumArray(candidate.risk_signals, RISK_SIGNALS, `${path}.risk_signals`, errors);
    enumValue(candidate.status, new Set(["needs_info", "approved", "deferred", "rejected"]), `${path}.status`, errors);
    stringArray(candidate.missing_information, `${path}.missing_information`, errors);
    if (candidate.developer_todos !== undefined) stringArray(candidate.developer_todos, `${path}.developer_todos`, errors);
    validateCandidateReviewFields(candidate, path, errors);
    if (candidate.status === "approved") {
      for (const issue of candidateSemanticReadinessIssues(candidate)) {
        errors.push(`${path} ${String(candidate.asset_id)} approved 상태가 될 수 없습니다: ${issue}`);
      }
    }
    if (typeof candidate.asset_id === "string") {
      if (byId.has(candidate.asset_id)) errors.push(`${path}.asset_id ${candidate.asset_id}가 중복됩니다.`);
      byId.set(candidate.asset_id, candidate);
    }
  });
  return byId;
}

function validateCandidateReviewFields(candidate: Record<string, unknown>, path: string, errors: string[]) {
  if (candidate.adk_hints !== undefined) {
    if (!isRecord(candidate.adk_hints)) errors.push(`${path}.adk_hints 객체가 필요합니다.`);
    else {
      const keys = ["state_memory", "callbacks", "artifacts_events", "mcp_a2a", "streaming_grounding"] as const;
      exactKeys(candidate.adk_hints, keys, [], `${path}.adk_hints`, errors);
      for (const [key, value] of Object.entries(candidate.adk_hints)) if (typeof value !== "string") errors.push(`${path}.adk_hints.${key} 문자열 값이 필요합니다.`);
    }
  }
  if (candidate.missing_information_resolution !== undefined && typeof candidate.missing_information_resolution !== "string") errors.push(`${path}.missing_information_resolution 문자열 값이 필요합니다.`);
  if (candidate.resolved_missing_information !== undefined) stringArray(candidate.resolved_missing_information, `${path}.resolved_missing_information`, errors);
  if (candidate.resolution_applied_at !== undefined) nullableString(candidate.resolution_applied_at, `${path}.resolution_applied_at`, errors);
  if (candidate.schema_review_state !== undefined) enumValue(candidate.schema_review_state, new Set(["not_started", "drafted", "applied"]), `${path}.schema_review_state`, errors);
  if (candidate.side_effect !== undefined) enumValue(candidate.side_effect, new Set(["none", "read", "write", "read_write", "unknown"]), `${path}.side_effect`, errors);
  for (const key of ["auth_required", "audit_required", "citation_required", "grounding_required", "source_acl_required", "versioned", "effective_date_required"]) {
    if (candidate[key] !== undefined && typeof candidate[key] !== "boolean") errors.push(`${path}.${key} boolean 값이 필요합니다.`);
  }
  if (candidate.smoke_spec !== undefined && candidate.smoke_spec !== null) validateSmokeSpec(candidate.smoke_spec, `${path}.smoke_spec`, errors);
  if (candidate.resolution_draft !== undefined && candidate.resolution_draft !== null) {
    validateObject(candidate.resolution_draft, ["asset_id", "generated_at", "summary", "answers", "input_schema", "output_schema", "developer_todos", "graph_patch_notes", "smoke_spec", "reviewer_note"], `${path}.resolution_draft`, errors);
  }
}

function validateSmokeSpec(value: unknown, path: string, errors: string[]) {
  validateObject(value, ["sample_user_message", "synthetic_inputs", "expected_output_shape", "expected_event_markers", "mock_sources", "ready"], path, errors, (smoke) => {
    if (typeof smoke.sample_user_message !== "string") errors.push(`${path}.sample_user_message 문자열 값이 필요합니다.`);
    if (!isRecord(smoke.synthetic_inputs)) errors.push(`${path}.synthetic_inputs 객체가 필요합니다.`);
    if (!isRecord(smoke.expected_output_shape)) errors.push(`${path}.expected_output_shape 객체가 필요합니다.`);
    stringArray(smoke.expected_event_markers, `${path}.expected_event_markers`, errors);
    stringArray(smoke.mock_sources, `${path}.mock_sources`, errors);
    if (typeof smoke.ready !== "boolean") errors.push(`${path}.ready boolean 값이 필요합니다.`);
  });
}

function validateBindingAndConnection(candidate: Record<string, unknown>, path: string, errors: string[]) {
  const value = candidate.binding;
  const connection = candidate.connection;
  if (candidate.asset_type === "workflow") {
    if (value !== null || connection !== null) errors.push(`${path} Workflow binding과 connection은 null이어야 합니다.`);
    return;
  }
  if (candidate.asset_type === "tool" && value === null) errors.push(`${path}.binding 객체가 Tool 자산에 필요합니다.`);
  if (candidate.asset_type === "agent" && value !== null && (!isRecord(value) || value.kind !== "a2a")) {
    errors.push(`${path}.binding은 Agent에서 a2a 객체 또는 null이어야 합니다.`);
  }
  if (value === null) {
    if (connection !== null) errors.push(`${path}.connection은 binding이 null일 때 null이어야 합니다.`);
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${path}.binding은 객체 또는 null이어야 합니다.`);
    return;
  }
  enumValue(value.kind, BINDING_KINDS, `${path}.binding.kind`, errors);
  const kind = value.kind;
  if (kind === "mcp") {
    exactKeys(value, ["kind", "server_ref", "tool_name"], ["kind", "server_ref", "tool_name"], `${path}.binding`, errors);
    nonEmptyString(value.server_ref, `${path}.binding.server_ref`, errors);
    nonEmptyString(value.tool_name, `${path}.binding.tool_name`, errors);
  } else if (kind === "a2a") {
    exactKeys(value, ["kind", "contract_ref"], ["kind", "contract_ref"], `${path}.binding`, errors);
    nonEmptyString(value.contract_ref, `${path}.binding.contract_ref`, errors);
  } else {
    exactKeys(value, ["kind"], ["kind"], `${path}.binding`, errors);
  }
  if (candidate.asset_type === "tool" && value.kind === "a2a") errors.push(`${path}.binding Tool은 a2a를 사용할 수 없습니다.`);
  if (!isRecord(connection)) {
    errors.push(`${path}.connection 객체가 필요합니다.`);
    return;
  }
  exactKeys(connection, ["transport"], ["transport"], `${path}.connection`, errors);
  enumValue(connection.transport, TRANSPORT_KINDS, `${path}.connection.transport`, errors);
  if (candidate.asset_type === "agent" && value.kind === "a2a" && connection.transport !== "http") {
    errors.push(`${path}.connection.transport는 a2a Agent binding에서 http여야 합니다.`);
  }
}

function validateWorkflowProfile(candidate: Record<string, unknown>, path: string, errors: string[]) {
  if (candidate.asset_type !== "workflow") {
    if (candidate.workflow_profile !== null) errors.push(`${path}.workflow_profile은 Workflow가 아닌 자산에서 null이어야 합니다.`);
    return;
  }
  if (!isRecord(candidate.workflow_profile)) {
    errors.push(`${path}.workflow_profile이 Workflow 자산에 필요합니다.`);
    return;
  }
  const profile = candidate.workflow_profile;
  exactKeys(profile, ["representation", "coordination", "template_ref"], ["representation", "coordination", "template_ref"], `${path}.workflow_profile`, errors);
  enumValue(profile.representation, WORKFLOW_REPRESENTATIONS, `${path}.workflow_profile.representation`, errors);
  enumValue(profile.coordination, WORKFLOW_COORDINATIONS, `${path}.workflow_profile.coordination`, errors);
  nullableString(profile.template_ref, `${path}.workflow_profile.template_ref`, errors);
}

function validateExposure(candidate: Record<string, unknown>, path: string, errors: string[]) {
  if (candidate.exposure === null) return;
  if (candidate.asset_type !== "agent") {
    errors.push(`${path}.exposure는 Agent 자산에만 허용됩니다.`);
    return;
  }
  if (!isRecord(candidate.exposure)) {
    errors.push(`${path}.exposure는 객체 또는 null이어야 합니다.`);
    return;
  }
  exactKeys(candidate.exposure, ["protocol", "contract_ref"], ["protocol", "contract_ref"], `${path}.exposure`, errors);
  if (candidate.exposure.protocol !== "a2a") errors.push(`${path}.exposure.protocol은 a2a여야 합니다.`);
  nonEmptyString(candidate.exposure.contract_ref, `${path}.exposure.contract_ref`, errors);
}

function validateGraph(
  value: unknown,
  candidates: ReadonlyMap<string, Record<string, unknown>>,
  normalizedRequirementId: string | null,
  errors: string[]
) {
  const path = "graph";
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  exactKeys(value, ["graph_id", "source_requirement_id", "workflow_ref", "nodes", "edges", "regions"], ["graph_id", "source_requirement_id", "workflow_ref", "nodes", "edges", "regions"], path, errors);
  nonEmptyString(value.graph_id, `${path}.graph_id`, errors);
  nonEmptyString(value.source_requirement_id, `${path}.source_requirement_id`, errors);
  if (normalizedRequirementId !== null && value.source_requirement_id !== normalizedRequirementId) {
    errors.push(`${path}.source_requirement_id는 normalizedRequirement.id와 일치해야 합니다.`);
  }
  nullableString(value.workflow_ref, `${path}.workflow_ref`, errors);
  if (typeof value.workflow_ref === "string" && candidates.get(value.workflow_ref)?.asset_type !== "workflow") {
    errors.push(`${path}.workflow_ref ${value.workflow_ref}는 Workflow asset을 가리켜야 합니다.`);
  }

  const nodeIds = new Set<string>();
  if (!Array.isArray(value.nodes)) errors.push(`${path}.nodes 배열이 필요합니다.`);
  else value.nodes.forEach((node, index) => validateNode(node, index, candidates, nodeIds, errors));

  const edgeIds = new Set<string>();
  if (!Array.isArray(value.edges)) errors.push(`${path}.edges 배열이 필요합니다.`);
  else value.edges.forEach((edge, index) => validateEdge(edge, index, nodeIds, edgeIds, errors));

  validateRegions(value.regions, nodeIds, errors);
  errors.push(...graphOwnershipReadinessIssues(value));
}

function validateNode(
  value: unknown,
  index: number,
  candidates: ReadonlyMap<string, Record<string, unknown>>,
  ids: Set<string>,
  errors: string[]
) {
  const path = `graph.nodes[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  const common = ["id", "label", "node_kind"] as const;
  const kind = value.node_kind;
  let allowed: readonly string[] = common;
  let required: readonly string[] = common;
  if (kind === "agent") allowed = required = [...common, "agent_ref", "available_tools"];
  else if (kind === "tool") allowed = required = [...common, "tool_ref", "invocation_control"];
  else if (kind === "function") allowed = required = [...common, "role"];
  else if (kind === "human_input") allowed = required = [...common, "human_input_contract"];
  else if (kind === "subworkflow") allowed = required = [...common, "workflow_ref"];
  exactKeys(value, allowed, required, path, errors);
  nonEmptyString(value.id, `${path}.id`, errors);
  nonEmptyString(value.label, `${path}.label`, errors);
  enumValue(kind, NODE_KINDS, `${path}.node_kind`, errors);
  if (typeof value.id === "string") {
    if (ids.has(value.id)) errors.push(`${path}.id ${value.id}가 중복됩니다.`);
    ids.add(value.id);
  }
  if (kind === "agent") {
    nonEmptyString(value.agent_ref, `${path}.agent_ref`, errors);
    if (typeof value.agent_ref === "string" && candidates.get(value.agent_ref)?.asset_type !== "agent") errors.push(`${path}.agent_ref는 Agent asset을 가리켜야 합니다.`);
    if (!Array.isArray(value.available_tools)) errors.push(`${path}.available_tools 배열이 필요합니다.`);
    else value.available_tools.forEach((entry, toolIndex) => {
      const toolPath = `${path}.available_tools[${toolIndex}]`;
      if (!isRecord(entry)) errors.push(`${toolPath} 객체가 필요합니다.`);
      else {
        exactKeys(entry, ["tool_ref", "invocation_control"], ["tool_ref", "invocation_control"], toolPath, errors);
        nonEmptyString(entry.tool_ref, `${toolPath}.tool_ref`, errors);
        if (entry.invocation_control !== "agent") errors.push(`${toolPath}.invocation_control은 agent여야 합니다.`);
        if (typeof entry.tool_ref === "string" && candidates.get(entry.tool_ref)?.asset_type !== "tool") errors.push(`${toolPath}.tool_ref는 Tool asset을 가리켜야 합니다.`);
      }
    });
  } else if (kind === "tool") {
    nonEmptyString(value.tool_ref, `${path}.tool_ref`, errors);
    if (value.invocation_control !== "workflow") errors.push(`${path}.invocation_control은 workflow여야 합니다.`);
    if (typeof value.tool_ref === "string" && candidates.get(value.tool_ref)?.asset_type !== "tool") errors.push(`${path}.tool_ref는 Tool asset을 가리켜야 합니다.`);
  } else if (kind === "function") {
    enumValue(value.role, FUNCTION_ROLES, `${path}.role`, errors);
  } else if (kind === "human_input") {
    validateHumanInputContract(value.human_input_contract, `${path}.human_input_contract`, errors);
  } else if (kind === "subworkflow") {
    nonEmptyString(value.workflow_ref, `${path}.workflow_ref`, errors);
    if (typeof value.workflow_ref === "string" && candidates.get(value.workflow_ref)?.asset_type !== "workflow") errors.push(`${path}.workflow_ref는 Workflow asset을 가리켜야 합니다.`);
  }
}

function validateEdge(value: unknown, index: number, nodeIds: ReadonlySet<string>, ids: Set<string>, errors: string[]) {
  const path = `graph.edges[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  exactKeys(value, ["id", "from", "to", "control", "channel"], ["id", "from", "to", "control", "channel"], path, errors);
  for (const key of ["id", "from", "to"] as const) nonEmptyString(value[key], `${path}.${key}`, errors);
  if (typeof value.id === "string") {
    if (ids.has(value.id)) errors.push(`${path}.id ${value.id}가 중복됩니다.`);
    ids.add(value.id);
  }
  if (typeof value.from === "string" && !nodeIds.has(value.from)) errors.push(`${path}.from ${value.from}가 존재하지 않는 Node를 가리킵니다.`);
  if (typeof value.to === "string" && !nodeIds.has(value.to)) errors.push(`${path}.to ${value.to}가 존재하지 않는 Node를 가리킵니다.`);
  if (!isRecord(value.control)) errors.push(`${path}.control 객체가 필요합니다.`);
  else {
    exactKeys(value.control, ["kind", "condition", "accepted_aliases", "default"], ["kind", "condition", "accepted_aliases", "default"], `${path}.control`, errors);
    enumValue(value.control.kind, CONTROL_KINDS, `${path}.control.kind`, errors);
    nullableString(value.control.condition, `${path}.control.condition`, errors);
    stringArray(value.control.accepted_aliases, `${path}.control.accepted_aliases`, errors);
    if (typeof value.control.default !== "boolean") errors.push(`${path}.control.default boolean 값이 필요합니다.`);
  }
  if (value.channel !== null) enumValue(value.channel, CHANNELS, `${path}.channel`, errors);
}

function validateRegions(value: unknown, nodeIds: ReadonlySet<string>, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("graph.regions 배열이 필요합니다.");
    return;
  }
  const regionIds = new Set<string>();
  value.forEach((region, index) => {
    const path = `graph.regions[${index}]`;
    if (!isRecord(region)) {
      errors.push(`${path} 객체가 필요합니다.`);
      return;
    }
    exactKeys(region, ["id", "kind", "node_ids", "entry_node_ids", "exit_node_ids", "parent_region_id"], ["id", "kind", "node_ids", "entry_node_ids", "exit_node_ids", "parent_region_id"], path, errors);
    nonEmptyString(region.id, `${path}.id`, errors);
    enumValue(region.kind, REGION_KINDS, `${path}.kind`, errors);
    for (const key of ["node_ids", "entry_node_ids", "exit_node_ids"] as const) {
      stringArray(region[key], `${path}.${key}`, errors);
      if (Array.isArray(region[key])) for (const id of region[key]) if (typeof id === "string" && !nodeIds.has(id)) errors.push(`${path}.${key}에 존재하지 않는 Node ${id}가 있습니다.`);
    }
    if (Array.isArray(region.node_ids)) {
      const members = new Set(region.node_ids.filter((id): id is string => typeof id === "string"));
      for (const key of ["entry_node_ids", "exit_node_ids"] as const) {
        if (Array.isArray(region[key]) && region[key].some((id) => typeof id === "string" && !members.has(id))) {
          errors.push(`${path}.${key}는 node_ids에 포함된 Node만 가리켜야 합니다.`);
        }
      }
    }
    nullableString(region.parent_region_id, `${path}.parent_region_id`, errors);
    if (typeof region.id === "string") {
      if (regionIds.has(region.id)) errors.push(`${path}.id ${region.id}가 중복됩니다.`);
      regionIds.add(region.id);
    }
  });
  value.forEach((region, index) => {
    if (isRecord(region) && typeof region.parent_region_id === "string" && !regionIds.has(region.parent_region_id)) errors.push(`graph.regions[${index}].parent_region_id가 존재하지 않는 Region을 가리킵니다.`);
  });
  validateRegionHierarchy(value, errors);
}

function validateRegionHierarchy(values: unknown[], errors: string[]) {
  const parentById = new Map<string, string | null>();
  for (const value of values) {
    if (!isRecord(value) || typeof value.id !== "string") continue;
    parentById.set(value.id, typeof value.parent_region_id === "string" ? value.parent_region_id : null);
  }
  for (const [regionId, initialParent] of parentById) {
    const visited = new Set([regionId]);
    let parent = initialParent;
    while (parent !== null && parentById.has(parent)) {
      if (visited.has(parent)) {
        errors.push(`graph.regions ${regionId}의 parent_region_id 체인이 순환합니다.`);
        break;
      }
      visited.add(parent);
      parent = parentById.get(parent) ?? null;
    }
  }
}

function validateA2AContracts(value: unknown, errors: string[]): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value)) {
    errors.push("a2aContracts 배열이 필요합니다.");
    return byId;
  }
  value.forEach((contract, index) => {
    const path = `a2aContracts[${index}]`;
    if (!isRecord(contract)) {
      errors.push(`${path} 객체가 필요합니다.`);
      return;
    }
    exactKeys(contract, A2A_KEYS, A2A_KEYS, path, errors);
    nonEmptyString(contract.contract_id, `${path}.contract_id`, errors);
    if (typeof contract.contract_id === "string" && !A2A_CONTRACT_ID_PATTERN.test(contract.contract_id)) {
      errors.push(`${path}.contract_id가 허용된 A2A ID 문법과 일치하지 않습니다.`);
    }
    nonEmptyString(contract.agent_ref, `${path}.agent_ref`, errors);
    nonEmptyString(contract.target_agent_name, `${path}.target_agent_name`, errors);
    nonEmptyString(contract.target_agent_purpose, `${path}.target_agent_purpose`, errors);
    enumValue(contract.contract_status, asSet(A2A_CONTRACT_STATUSES), `${path}.contract_status`, errors);
    validateA2ADetails(contract, path, errors);
    enumArray(contract.operations, asSet(A2A_OPERATION_NAMES), `${path}.operations`, errors);
    enumArray(contract.http_paths, asSet(A2A_HTTP_PATHS), `${path}.http_paths`, errors);
    if (typeof contract.contract_id === "string") {
      if (byId.has(contract.contract_id)) errors.push(`${path}.contract_id ${contract.contract_id}가 중복됩니다.`);
      byId.set(contract.contract_id, contract);
    }
  });
  return byId;
}

function validateA2AReferences(
  candidates: ReadonlyMap<string, Record<string, unknown>>,
  contracts: ReadonlyMap<string, Record<string, unknown>>,
  errors: string[]
) {
  for (const [assetId, candidate] of candidates) {
    const refs: Array<{ field: "binding" | "exposure"; ref: unknown }> = [];
    if (isRecord(candidate.binding) && candidate.binding.kind === "a2a") refs.push({ field: "binding", ref: candidate.binding.contract_ref });
    if (isRecord(candidate.exposure)) refs.push({ field: "exposure", ref: candidate.exposure.contract_ref });
    for (const { field, ref } of refs) {
      if (typeof ref !== "string") continue;
      const contract = contracts.get(ref);
      if (!contract) {
        errors.push(`assetCandidates ${assetId}의 contract_ref ${ref}가 a2aContracts를 가리키지 않습니다.`);
      } else if (contract.agent_ref !== assetId) {
        errors.push(`assetCandidates ${assetId}.${field}.contract_ref ${ref}의 A2A contract agent_ref는 같은 Agent여야 합니다.`);
      }
    }
  }
  for (const [contractId, contract] of contracts) {
    const agent = typeof contract.agent_ref === "string" ? candidates.get(contract.agent_ref) : undefined;
    if (agent?.asset_type !== "agent") {
      errors.push(`a2aContracts ${contractId}.agent_ref는 Agent asset을 가리켜야 합니다.`);
      continue;
    }
    const ownerRefs = [
      isRecord(agent.binding) && agent.binding.kind === "a2a" ? agent.binding.contract_ref : null,
      isRecord(agent.exposure) ? agent.exposure.contract_ref : null
    ];
    if (!ownerRefs.includes(contractId)) {
      errors.push(`a2aContracts ${contractId}는 agent_ref Agent의 binding 또는 exposure에서 참조되어야 합니다.`);
    }
  }
}

function validateRuntimeContracts(
  value: unknown,
  candidates: ReadonlyMap<string, Record<string, unknown>>,
  errors: string[]
) {
  if (!Array.isArray(value)) {
    errors.push("runtimeContracts 배열이 필요합니다.");
    return;
  }
  const contractIds = new Set<string>();
  value.forEach((contract, index) => {
    const path = `runtimeContracts[${index}]`;
    if (!isRecord(contract)) {
      errors.push(`${path} 객체가 필요합니다.`);
      return;
    }
    exactKeys(contract, RUNTIME_KEYS, RUNTIME_REQUIRED_KEYS, path, errors);
    nonEmptyString(contract.contract_id, `${path}.contract_id`, errors);
    if (typeof contract.contract_id === "string") {
      if (contractIds.has(contract.contract_id)) errors.push(`${path}.contract_id ${contract.contract_id}가 중복됩니다.`);
      contractIds.add(contract.contract_id);
    }
    enumValue(contract.contract_kind, RUNTIME_KINDS, `${path}.contract_kind`, errors);
    nullableString(contract.asset_id, `${path}.asset_id`, errors);
    if (typeof contract.asset_id === "string" && !candidates.has(contract.asset_id)) {
      errors.push(`${path}.asset_id ${contract.asset_id}가 존재하지 않는 assetCandidate를 가리킵니다.`);
    }
    nonEmptyString(contract.title, `${path}.title`, errors);
    enumValue(contract.contract_status, RUNTIME_STATUSES, `${path}.contract_status`, errors);
    nonEmptyString(contract.summary, `${path}.summary`, errors);
    stringArray(contract.required_review_fields, `${path}.required_review_fields`, errors);
    if (typeof contract.reviewer_notes !== "string") errors.push(`${path}.reviewer_notes 문자열 값이 필요합니다.`);
    stringArray(contract.identifiers, `${path}.identifiers`, errors);
    stringArray(contract.developer_todos, `${path}.developer_todos`, errors);
    validateRuntimeDetails(contract, path, errors, candidates);
  });
}

function validateA2ADetails(contract: Record<string, unknown>, path: string, errors: string[]) {
  validateObject(contract.agent_card, ["discovery_method", "agent_card_url", "version", "notes"], `${path}.agent_card`, errors, (card) => {
    for (const key of ["discovery_method", "agent_card_url", "version", "notes"]) nonEmptyString(card[key], `${path}.agent_card.${key}`, errors);
  });
  validateObjectArray(contract.supported_interfaces, ["url", "protocol_binding", "protocol_version", "tenant_policy"], `${path}.supported_interfaces`, errors);
  stringArray(contract.input_modes, `${path}.input_modes`, errors);
  stringArray(contract.output_modes, `${path}.output_modes`, errors);
  validateObjectArray(contract.security_schemes, ["name", "scheme"], `${path}.security_schemes`, errors);
  if (!Array.isArray(contract.security_requirements)) errors.push(`${path}.security_requirements 배열이 필요합니다.`);
  else contract.security_requirements.forEach((entry, index) => {
    validateObject(entry, ["scheme_name", "scopes"], `${path}.security_requirements[${index}]`, errors, (record) => {
      nonEmptyString(record.scheme_name, `${path}.security_requirements[${index}].scheme_name`, errors);
      stringArray(record.scopes, `${path}.security_requirements[${index}].scopes`, errors);
    });
  });
  stringArray(contract.skills, `${path}.skills`, errors);
  stringArray(contract.extensions, `${path}.extensions`, errors);
  validateObject(contract.message_contract, ["allowed_part_fields", "allowed_roles"], `${path}.message_contract`, errors, (message) => {
    enumArray(message.allowed_part_fields, asSet(A2A_PART_FIELDS), `${path}.message_contract.allowed_part_fields`, errors);
    enumArray(message.allowed_roles, asSet(A2A_ROLES), `${path}.message_contract.allowed_roles`, errors);
  });
  validateObject(contract.task_lifecycle, ["states", "allowed_transitions", "terminal_states", "input_required_followup", "auth_required_followup"], `${path}.task_lifecycle`, errors, (lifecycle) => {
    enumArray(lifecycle.states, asSet(A2A_TASK_STATES), `${path}.task_lifecycle.states`, errors);
    enumArray(lifecycle.terminal_states, asSet(A2A_TASK_STATES), `${path}.task_lifecycle.terminal_states`, errors);
    if (!Array.isArray(lifecycle.allowed_transitions)) errors.push(`${path}.task_lifecycle.allowed_transitions 배열이 필요합니다.`);
    else lifecycle.allowed_transitions.forEach((transition, index) => validateObject(transition, ["from", "to"], `${path}.task_lifecycle.allowed_transitions[${index}]`, errors, (record) => {
      enumValue(record.from, asSet(A2A_TASK_STATES), `${path}.task_lifecycle.allowed_transitions[${index}].from`, errors);
      enumValue(record.to, asSet(A2A_TASK_STATES), `${path}.task_lifecycle.allowed_transitions[${index}].to`, errors);
    }));
    nonEmptyString(lifecycle.input_required_followup, `${path}.task_lifecycle.input_required_followup`, errors);
    nonEmptyString(lifecycle.auth_required_followup, `${path}.task_lifecycle.auth_required_followup`, errors);
  });
  validateObject(contract.streaming, ["supported", "wrappers", "non_streaming_fallback"], `${path}.streaming`, errors, (streaming) => {
    if (typeof streaming.supported !== "boolean") errors.push(`${path}.streaming.supported boolean 값이 필요합니다.`);
    enumArray(streaming.wrappers, asSet(A2A_STREAM_WRAPPERS), `${path}.streaming.wrappers`, errors);
    nonEmptyString(streaming.non_streaming_fallback, `${path}.streaming.non_streaming_fallback`, errors);
  });
  validateObject(contract.artifact_contract, ["mutation_rules", "chunking_policy"], `${path}.artifact_contract`, errors, (artifact) => {
    nonEmptyString(artifact.mutation_rules, `${path}.artifact_contract.mutation_rules`, errors);
    nonEmptyString(artifact.chunking_policy, `${path}.artifact_contract.chunking_policy`, errors);
  });
  validateA2ARuntimePolicy(contract.adk_runtime_policy, `${path}.adk_runtime_policy`, errors);
  for (const key of ["adk_host_mapping", "timeout", "retry", "fallback", "cancellation", "unsupported_operation", "get_task_fallback", "auth", "token_handling", "audit", "data_policy"]) {
    nonEmptyString(contract[key], `${path}.${key}`, errors);
  }
  nullableString(contract.push_notification_policy, `${path}.push_notification_policy`, errors);
}

function validateA2ARuntimePolicy(value: unknown, path: string, errors: string[]) {
  validateObject(value, ["timeout_seconds", "auth", "retry_handoff", "fallback_handoff"], path, errors, (policy) => {
    if (policy.timeout_seconds !== null && (typeof policy.timeout_seconds !== "number" || policy.timeout_seconds <= 0)) errors.push(`${path}.timeout_seconds는 양수 또는 null이어야 합니다.`);
    validateObject(policy.auth, ["mode", "env_var", "metadata_key"], `${path}.auth`, errors, (auth) => {
      enumValue(auth.mode, new Set(["none", "bearer_env", "metadata_env"]), `${path}.auth.mode`, errors);
      nullableString(auth.env_var, `${path}.auth.env_var`, errors);
      nullableString(auth.metadata_key, `${path}.auth.metadata_key`, errors);
    });
    validateObject(policy.retry_handoff, ["max_attempts", "backoff_seconds", "retry_on"], `${path}.retry_handoff`, errors, (retry) => {
      if (retry.max_attempts !== null && (!Number.isInteger(retry.max_attempts) || (retry.max_attempts as number) < 1)) errors.push(`${path}.retry_handoff.max_attempts는 양의 정수 또는 null이어야 합니다.`);
      if (retry.backoff_seconds !== null && (typeof retry.backoff_seconds !== "number" || retry.backoff_seconds <= 0)) errors.push(`${path}.retry_handoff.backoff_seconds는 양수 또는 null이어야 합니다.`);
      stringArray(retry.retry_on, `${path}.retry_handoff.retry_on`, errors);
    });
    validateObject(policy.fallback_handoff, ["mode", "message"], `${path}.fallback_handoff`, errors, (fallback) => {
      enumValue(fallback.mode, new Set(["none", "manual_review", "local_event"]), `${path}.fallback_handoff.mode`, errors);
      nullableString(fallback.message, `${path}.fallback_handoff.message`, errors);
    });
  });
}

function validateRuntimeDetails(
  contract: Record<string, unknown>,
  path: string,
  errors: string[],
  candidates: ReadonlyMap<string, Record<string, unknown>>
) {
  const supportKeys = ["context_manager_required", "callback_broker_required", "human_approval_required", "idempotency_required", "audit_required", "compensation_required"] as const;
  validateObject(contract.runtime_support, supportKeys, `${path}.runtime_support`, errors, (support) => {
    for (const key of supportKeys) if (typeof support[key] !== "boolean") errors.push(`${path}.runtime_support.${key} boolean 값이 필요합니다.`);
  });
  validateObject(contract.operation, ["operation_type", "side_effect_level", "callback_expected", "async_resume_required"], `${path}.operation`, errors, (operation) => {
    enumValue(operation.operation_type, new Set(["read", "write", "approval", "batch", "notification", "unknown"]), `${path}.operation.operation_type`, errors);
    enumValue(operation.side_effect_level, new Set(["none", "read_only", "write", "financial_write", "customer_notification", "unknown"]), `${path}.operation.side_effect_level`, errors);
    if (typeof operation.callback_expected !== "boolean") errors.push(`${path}.operation.callback_expected boolean 값이 필요합니다.`);
    if (typeof operation.async_resume_required !== "boolean") errors.push(`${path}.operation.async_resume_required boolean 값이 필요합니다.`);
  });
  const policyKeys = ["auth_policy", "timeout_policy", "retry_policy", "fallback_policy", "masking_policy", "data_policy"] as const;
  validateObject(contract.policies, policyKeys, `${path}.policies`, errors, (policies) => {
    for (const key of policyKeys) if (typeof policies[key] !== "string") errors.push(`${path}.policies.${key} 문자열 값이 필요합니다.`);
  });
  validateAsyncResumeDetails(contract, path, errors, candidates);
  if (!isStringRecord(contract.graph_ir_annotations)) errors.push(`${path}.graph_ir_annotations는 string map이어야 합니다.`);
  if (!Array.isArray(contract.synthetic_examples) || contract.synthetic_examples.some((example) => !isRecord(example))) errors.push(`${path}.synthetic_examples는 객체 배열이어야 합니다.`);
}

function validateAsyncResumeDetails(
  contract: Record<string, unknown>,
  path: string,
  errors: string[],
  candidates: ReadonlyMap<string, Record<string, unknown>>
) {
  const isAsyncResume = contract.contract_kind === "async_resume";
  const approved = contract.contract_status === "approved";
  const support = isRecord(contract.runtime_support) ? contract.runtime_support : {};

  if (!isAsyncResume) {
    if (contract.resume_policy !== undefined && contract.resume_policy !== null) {
      errors.push(`${path}.resume_policy는 async_resume 계약에서만 사용할 수 있습니다.`);
    }
    if (contract.side_effect_guard !== undefined && contract.side_effect_guard !== null) {
      errors.push(`${path}.side_effect_guard는 async_resume 계약에서만 사용할 수 있습니다.`);
    }
    return;
  }

  if (!("resume_policy" in contract)) errors.push(`${path}.resume_policy 필드가 필요합니다.`);
  if (!("side_effect_guard" in contract)) errors.push(`${path}.side_effect_guard 필드가 필요합니다.`);
  if (contract.resume_policy === null || contract.resume_policy === undefined) {
    if (approved) errors.push(`${path}.resume_policy는 approved async_resume 계약에서 구조화된 값이어야 합니다.`);
  } else {
    validateObject(
      contract.resume_policy,
      ["interrupt_id", "correlation_scope", "timeout_seconds", "on_timeout", "duplicate_response", "conflicting_response", "restart_policy"],
      `${path}.resume_policy`,
      errors,
      (policy) => {
        nonEmptyString(policy.interrupt_id, `${path}.resume_policy.interrupt_id`, errors);
        enumValue(policy.correlation_scope, new Set(["invocation"]), `${path}.resume_policy.correlation_scope`, errors);
        if (typeof policy.timeout_seconds !== "number" || !Number.isFinite(policy.timeout_seconds) || policy.timeout_seconds <= 0) {
          errors.push(`${path}.resume_policy.timeout_seconds는 양수여야 합니다.`);
        }
        enumValue(policy.on_timeout, new Set(["expire_without_side_effect"]), `${path}.resume_policy.on_timeout`, errors);
        enumValue(policy.duplicate_response, new Set(["return_recorded_result"]), `${path}.resume_policy.duplicate_response`, errors);
        enumValue(policy.conflicting_response, new Set(["reject"]), `${path}.resume_policy.conflicting_response`, errors);
        enumValue(policy.restart_policy, new Set(["resume_incomplete_replay_completed"]), `${path}.resume_policy.restart_policy`, errors);
      }
    );
  }

  if (contract.side_effect_guard === null || contract.side_effect_guard === undefined) {
    if (approved && support.idempotency_required === true) {
      errors.push(`${path}.side_effect_guard는 idempotency_required=true인 approved async_resume 계약에서 구조화된 값이어야 합니다.`);
    }
    return;
  }
  validateObject(
    contract.side_effect_guard,
    ["tool_ref", "idempotency_key_input", "delivery_semantics", "ledger_scope"],
    `${path}.side_effect_guard`,
    errors,
    (guard) => {
      nonEmptyString(guard.tool_ref, `${path}.side_effect_guard.tool_ref`, errors);
      nonEmptyString(guard.idempotency_key_input, `${path}.side_effect_guard.idempotency_key_input`, errors);
      enumValue(guard.delivery_semantics, new Set(["at_most_once"]), `${path}.side_effect_guard.delivery_semantics`, errors);
      enumValue(guard.ledger_scope, new Set(["session_state"]), `${path}.side_effect_guard.ledger_scope`, errors);
      const tool = typeof guard.tool_ref === "string" ? candidates.get(guard.tool_ref) : undefined;
      if (!tool || tool.asset_type !== "tool") {
        errors.push(`${path}.side_effect_guard.tool_ref는 존재하는 Tool asset을 가리켜야 합니다.`);
      } else if (
        typeof guard.idempotency_key_input === "string" &&
        !Array.isArray(tool.inputs)
      ) {
        errors.push(`${path}.side_effect_guard.idempotency_key_input을 검증할 Tool inputs가 필요합니다.`);
      } else if (
        typeof guard.idempotency_key_input === "string" &&
        !(tool.inputs as unknown[]).some((input) => isRecord(input) && input.name === guard.idempotency_key_input)
      ) {
        errors.push(`${path}.side_effect_guard.idempotency_key_input ${guard.idempotency_key_input}가 Tool inputs에 없습니다.`);
      }
    }
  );
}

function validateObject(
  value: unknown,
  keys: readonly string[],
  path: string,
  errors: string[],
  validate?: (record: Record<string, unknown>) => void
) {
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  exactKeys(value, keys, keys, path, errors);
  validate?.(value);
}

function validateObjectArray(value: unknown, keys: readonly string[], path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} 배열이 필요합니다.`);
    return;
  }
  value.forEach((entry, index) => validateObject(entry, keys, `${path}[${index}]`, errors, (record) => {
    for (const key of keys) nonEmptyString(record[key], `${path}[${index}].${key}`, errors);
  }));
}

function validateHumanInputContract(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) {
    errors.push(`${path} 객체가 필요합니다.`);
    return;
  }
  const keys = ["message", "payload_schema_ref", "response_schema_ref", "response_mapping", "choice_options", "accepted_aliases", "default_choice"] as const;
  exactKeys(value, keys, ["message", "payload_schema_ref", "response_schema_ref", "response_mapping"], path, errors);
  nonEmptyString(value.message, `${path}.message`, errors);
  nullableString(value.payload_schema_ref, `${path}.payload_schema_ref`, errors);
  nullableString(value.response_schema_ref, `${path}.response_schema_ref`, errors);
  if (value.response_mapping !== null && !isStringRecord(value.response_mapping)) errors.push(`${path}.response_mapping은 string map 또는 null이어야 합니다.`);
  if (value.choice_options !== undefined && value.choice_options !== null) stringArray(value.choice_options, `${path}.choice_options`, errors);
  if (value.accepted_aliases !== undefined && value.accepted_aliases !== null) {
    if (!isRecord(value.accepted_aliases)) errors.push(`${path}.accepted_aliases는 string array map 또는 null이어야 합니다.`);
    else for (const [choice, aliases] of Object.entries(value.accepted_aliases)) stringArray(aliases, `${path}.accepted_aliases.${choice}`, errors);
  }
  if (value.default_choice !== undefined) nullableString(value.default_choice, `${path}.default_choice`, errors);
}

function fieldArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${path} 배열이 필요합니다.`);
    return;
  }
  value.forEach((field, index) => {
    const fieldPath = `${path}[${index}]`;
    if (!isRecord(field)) errors.push(`${fieldPath} 객체가 필요합니다.`);
    else {
      exactKeys(field, ["name", "type", "required", "schema"], ["name", "type"], fieldPath, errors);
      nonEmptyString(field.name, `${fieldPath}.name`, errors);
      nonEmptyString(field.type, `${fieldPath}.type`, errors);
      if (field.required !== undefined && typeof field.required !== "boolean") errors.push(`${fieldPath}.required는 boolean이어야 합니다.`);
      if (field.schema !== undefined && !isRecord(field.schema)) errors.push(`${fieldPath}.schema는 객체여야 합니다.`);
    }
  });
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  required: readonly string[],
  path: string,
  errors: string[]
) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) errors.push(`${path}.${key}는 허용되지 않는 필드입니다.`);
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${path}.${key} 필드가 필요합니다.`);
}

function nonEmptyString(value: unknown, path: string, errors: string[]) {
  if (typeof value !== "string" || !value.trim()) errors.push(`${path} 비어 있지 않은 문자열이 필요합니다.`);
}

function nullableString(value: unknown, path: string, errors: string[]) {
  if (value !== null && (typeof value !== "string" || !value.trim())) errors.push(`${path}는 비어 있지 않은 문자열 또는 null이어야 합니다.`);
}

function stringArray(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) errors.push(`${path}는 비어 있지 않은 문자열 배열이어야 합니다.`);
}

function enumArray(value: unknown, allowed: ReadonlySet<string>, path: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.has(item))) errors.push(`${path}에 허용되지 않는 값이 있습니다.`);
}

function enumValue(value: unknown, allowed: ReadonlySet<string>, path: string, errors: string[]) {
  if (typeof value !== "string" || !allowed.has(value)) errors.push(`${path} 값이 허용된 enum이 아닙니다.`);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string" && item.trim().length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
