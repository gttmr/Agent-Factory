import {
  GRAPH_CONTAINER_KINDS,
  GRAPH_EDGE_KINDS,
  GRAPH_EXECUTION_SEMANTICS,
  GRAPH_LANE_IDS,
  GRAPH_LAYOUT_POLICIES,
  GRAPH_NODE_KINDS
} from "../src/analyzer/types";

const moduleCategories = new Set(["agent", "workflow", "adapter", "remote_a2a"]);
const adapterKinds = new Set([
  "legacy_api",
  "retrieval",
  "rule_registry",
  "data_query",
  "template",
  "computation",
  "external_service",
  "unknown"
]);
const agentKinds = new Set(["specialist", "shared"]);
const workflowKinds = new Set(["orchestration", "graph", "dynamic", "unknown"]);
const remoteContractKinds = new Set(["a2a", "unknown"]);
const runtimeContractKinds = new Set([
  "mcp_legacy_adapter",
  "eai_legacy_adapter",
  "context_manager",
  "callback_broker",
  "adk_callback",
  "async_resume"
]);
const runtimeContractStatuses = new Set(["draft", "needs_info", "approved", "rejected"]);
const riskLevels = new Set(["low", "medium", "high"]);
const moduleStatuses = new Set(["needs_info", "approved", "deferred", "rejected"]);
const requirementStatuses = new Set(["draft", "reviewed", "approved", "rejected"]);
const riskSignals = new Set([
  "personal_data",
  "financial_data",
  "credit_decision_support",
  "customer_impact",
  "external_message",
  "transaction_write",
  "human_approval_required",
  "audit_required"
]);
const systemAccess = new Set(["unknown", "read", "write", "read_write", "not_required"]);
const graphNodeKinds: ReadonlySet<string> = new Set(GRAPH_NODE_KINDS);
const graphContainerKinds: ReadonlySet<string> = new Set(GRAPH_CONTAINER_KINDS);
const graphEdgeKinds: ReadonlySet<string> = new Set(GRAPH_EDGE_KINDS);
const graphLaneIds: ReadonlySet<string> = new Set(GRAPH_LANE_IDS);
const graphLayoutPolicies: ReadonlySet<string> = new Set(GRAPH_LAYOUT_POLICIES);
const graphExecutionSemantics: ReadonlySet<string> = new Set(GRAPH_EXECUTION_SEMANTICS);
const adkHintKeys = new Set(["state_memory", "callbacks", "artifacts_events", "mcp_a2a", "streaming_grounding"]);
const remoteRequiredFields = [
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

export function validateAnalysisResult(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["응답 최상위 값은 객체여야 합니다."];

  validateNormalizedRequirement(value.normalizedRequirement, errors);
  validateEvidence(value.evidence, errors);
  validateModuleCandidates(value.moduleCandidates, errors);
  validateRuntimeContracts(value.runtimeContracts, errors);
  validateProcessFlow(value.processFlow, errors);

  return errors;
}

function validateRuntimeContracts(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("runtimeContracts 배열이 필요합니다.");
    return;
  }
  value.forEach((contract, index) => {
    const label = `runtimeContracts[${index}]`;
    if (!isRecord(contract)) {
      errors.push(`${label} 객체가 필요합니다.`);
      return;
    }
    if (typeof contract.contract_id !== "string" || !/^rtc-[a-z0-9-]+$/.test(contract.contract_id)) {
      errors.push(`${label}.contract_id는 rtc-* 패턴이어야 합니다.`);
    }
    if (typeof contract.contract_kind !== "string" || !runtimeContractKinds.has(contract.contract_kind)) {
      errors.push(`${label}.contract_kind 값이 올바르지 않습니다.`);
    }
    if (typeof contract.contract_status !== "string" || !runtimeContractStatuses.has(contract.contract_status)) {
      errors.push(`${label}.contract_status 값이 올바르지 않습니다.`);
    }
    expectString(contract, "title", errors);
    expectString(contract, "summary", errors);
    expectStringArray(contract.required_review_fields, `${label}.required_review_fields`, errors);
    expectStringArray(contract.identifiers, `${label}.identifiers`, errors);
    expectStringArray(contract.developer_todos, `${label}.developer_todos`, errors);
    ["runtime_support", "operation", "policies", "graph_ir_annotations"].forEach((key) => {
      if (!isRecord(contract[key])) errors.push(`${label}.${key} 객체가 필요합니다.`);
    });
  });
}

function validateNormalizedRequirement(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("normalizedRequirement 객체가 필요합니다.");
    return;
  }
  expectString(value, "id", errors);
  if (typeof value.id === "string" && !/^req-[a-z0-9-]+$/.test(value.id)) {
    errors.push("normalizedRequirement.id는 req-* 패턴이어야 합니다.");
  }
  expectString(value, "title", errors);
  expectString(value, "raw_text", errors);
  expectString(value, "domain", errors);
  if (!isRecord(value.requester)) {
    errors.push("normalizedRequirement.requester 객체가 필요합니다.");
  } else {
    expectString(value.requester, "team", errors);
    expectString(value.requester, "role", errors);
  }
  expectString(value, "business_goal", errors);
  expectStringArray(value.current_process, "normalizedRequirement.current_process", errors);
  validateFields(value.inputs, "normalizedRequirement.inputs", errors);
  validateFields(value.outputs, "normalizedRequirement.outputs", errors);
  validateSystems(value.systems, errors);
  validateRiskSignals(value.risk_signals, "normalizedRequirement.risk_signals", errors);
  expectStringArray(value.missing_information, "normalizedRequirement.missing_information", errors);
  expectStringArray(value.contradictions, "normalizedRequirement.contradictions", errors);
  if (typeof value.status !== "string" || !requirementStatuses.has(value.status)) {
    errors.push("normalizedRequirement.status 값이 올바르지 않습니다.");
  }
}

function validateEvidence(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("evidence 객체가 필요합니다.");
    return;
  }
  [
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
    "assumptions"
  ].forEach((key) => {
    if (key === "risk_signals") validateRiskSignals(value[key], `evidence.${key}`, errors);
    else if (key.endsWith("_goal") || key.endsWith("_hint") || key === "user_role") expectString(value, key, errors);
    else expectStringArray(value[key], `evidence.${key}`, errors);
  });
}

function validateModuleCandidates(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("moduleCandidates 배열이 필요합니다.");
    return;
  }
  value.forEach((candidate, index) => {
    const label = `moduleCandidates[${index}]`;
    if (!isRecord(candidate)) {
      errors.push(`${label} 객체가 필요합니다.`);
      return;
    }
    expectString(candidate, "id", errors);
    expectString(candidate, "source_requirement_id", errors);
    if (typeof candidate.id === "string" && !/^mod-[a-z0-9-]+$/.test(candidate.id)) {
      errors.push(`${label}.id는 mod-* 패턴이어야 합니다.`);
    }
    if (
      typeof candidate.source_requirement_id === "string" &&
      !/^req-[a-z0-9-]+$/.test(candidate.source_requirement_id)
    ) {
      errors.push(`${label}.source_requirement_id는 req-* 패턴이어야 합니다.`);
    }
    expectString(candidate, "name", errors);
    expectString(candidate, "rationale", errors);
    validateFields(candidate.inputs, `${label}.inputs`, errors);
    validateFields(candidate.outputs, `${label}.outputs`, errors);
    validateRiskSignals(candidate.risk_signals, `${label}.risk_signals`, errors);
    expectStringArray(candidate.missing_information, `${label}.missing_information`, errors);
    validateAdkHints(candidate.adk_hints, `${label}.adk_hints`, errors);

    if (typeof candidate.module_category !== "string" || !moduleCategories.has(candidate.module_category)) {
      errors.push(`${label}.module_category 값이 올바르지 않습니다.`);
      return;
    }
    if (typeof candidate.confidence !== "number" || candidate.confidence < 0 || candidate.confidence > 1) {
      errors.push(`${label}.confidence 값은 0 이상 1 이하 숫자여야 합니다.`);
    }
    if (typeof candidate.reuse_candidate !== "boolean") {
      errors.push(`${label}.reuse_candidate 값은 boolean이어야 합니다.`);
    }
    if (typeof candidate.risk_level !== "string" || !riskLevels.has(candidate.risk_level)) {
      errors.push(`${label}.risk_level 값이 올바르지 않습니다.`);
    }
    if (typeof candidate.status !== "string" || !moduleStatuses.has(candidate.status)) {
      errors.push(`${label}.status는 live analyzer에서 approved일 수 없습니다.`);
    }

    if (candidate.module_category === "adapter" && !adapterKinds.has(String(candidate.adapter_kind))) {
      errors.push(`${label} adapter에는 adapter_kind가 필요합니다.`);
    }
    if (candidate.module_category === "agent" && !agentKinds.has(String(candidate.agent_kind))) {
      errors.push(`${label} agent에는 agent_kind가 필요합니다.`);
    }
    if (candidate.module_category === "workflow" && !workflowKinds.has(String(candidate.workflow_kind))) {
      errors.push(`${label} workflow에는 workflow_kind가 필요합니다.`);
    }
    if (candidate.module_category === "remote_a2a") {
      if (!remoteContractKinds.has(String(candidate.remote_contract_kind))) {
        errors.push(`${label} remote_a2a에는 remote_contract_kind가 필요합니다.`);
      }
      if (candidate.risk_level !== "high") {
        errors.push(`${label} remote_a2a는 high risk여야 합니다.`);
      }
      const missing = remoteRequiredFields.filter((field) => !truthyString(candidate[field]));
      if (missing.length) {
        errors.push(`${label} remote_a2a 계약 필드 누락: ${missing.join(", ")}`);
      }
    }
  });
}

function validateAdkHints(value: unknown, label: string, errors: string[]) {
  if (value === undefined || value === null) {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${label} 객체 또는 null이어야 합니다.`);
    return;
  }
  Object.entries(value).forEach(([key, hint]) => {
    if (!adkHintKeys.has(key)) {
      errors.push(`${label}.${key}는 허용되지 않은 adk_hints 키입니다.`);
      return;
    }
    if (hint === null) {
      return;
    }
    if (!truthyString(hint)) {
      errors.push(`${label}.${key} 값은 비어 있지 않은 문자열 또는 null이어야 합니다.`);
    }
  });
}

function validateProcessFlow(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    errors.push("processFlow 객체가 필요합니다.");
    return;
  }
  expectString(value, "requirement_id", errors);
  if (typeof value.requirement_id === "string" && !/^req-[a-z0-9-]+$/.test(value.requirement_id)) {
    errors.push("processFlow.requirement_id는 req-* 패턴이어야 합니다.");
  }
  expectString(value, "graph_id", errors);
  if (typeof value.graph_id === "string" && !/^graph-[0-9]+$/.test(value.graph_id)) {
    errors.push("processFlow.graph_id는 graph-NNN 패턴이어야 합니다.");
  }
  if (value.root_workflow_module_id !== null && value.root_workflow_module_id !== undefined && !truthyString(value.root_workflow_module_id)) {
    errors.push("processFlow.root_workflow_module_id는 문자열 또는 null이어야 합니다.");
  }
  if (!Array.isArray(value.containers)) {
    errors.push("processFlow.containers 배열이 필요합니다.");
  } else {
    value.containers.forEach((container, index) => {
      if (!isRecord(container)) {
        errors.push(`processFlow.containers[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(container, "id", errors);
      expectString(container, "label", errors);
      if (typeof container.container_kind !== "string" || !graphContainerKinds.has(container.container_kind)) {
        errors.push(`processFlow.containers[${index}].container_kind 값이 올바르지 않습니다.`);
      }
      if (typeof container.layout_policy !== "string" || !graphLayoutPolicies.has(container.layout_policy)) {
        errors.push(`processFlow.containers[${index}].layout_policy 값이 올바르지 않습니다.`);
      }
      ["contains_node_ids", "entry_node_ids", "exit_node_ids"].forEach((key) => {
        if (!Array.isArray(container[key])) {
          errors.push(`processFlow.containers[${index}].${key} 배열이 필요합니다.`);
        }
      });
    });
  }
  if (!Array.isArray(value.lanes)) {
    errors.push("processFlow.lanes 배열이 필요합니다.");
  }
  if (!isRecord(value.validation)) {
    errors.push("processFlow.validation 객체가 필요합니다.");
  }
  if (!Array.isArray(value.nodes)) {
    errors.push("processFlow.nodes 배열이 필요합니다.");
  } else {
    value.nodes.forEach((node, index) => {
      if (!isRecord(node)) {
        errors.push(`processFlow.nodes[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(node, "id", errors);
      expectString(node, "label", errors);
      if ("type" in node || "subtype" in node) {
        errors.push(`processFlow.nodes[${index}] legacy type/subtype 필드는 허용되지 않습니다.`);
      }
      if (typeof node.node_kind !== "string" || !graphNodeKinds.has(node.node_kind)) {
        errors.push(`processFlow.nodes[${index}].node_kind 값이 올바르지 않습니다.`);
      }
      if (typeof node.lane_id !== "string" || !graphLaneIds.has(node.lane_id)) {
        errors.push(`processFlow.nodes[${index}].lane_id 값이 올바르지 않습니다.`);
      }
      if (node.module_id !== null && node.module_id !== undefined && !truthyString(node.module_id)) {
        errors.push(`processFlow.nodes[${index}].module_id 값은 문자열 또는 null이어야 합니다.`);
      }
      if (!Array.isArray(node.input_ports) || !Array.isArray(node.output_ports) || !Array.isArray(node.schema_refs)) {
        errors.push(`processFlow.nodes[${index}] input_ports/output_ports/schema_refs 배열이 필요합니다.`);
      }
    });
  }
  if (!Array.isArray(value.edges)) {
    errors.push("processFlow.edges 배열이 필요합니다.");
  } else {
    value.edges.forEach((edge, index) => {
      if (!isRecord(edge)) {
        errors.push(`processFlow.edges[${index}] 객체가 필요합니다.`);
        return;
      }
      expectString(edge, "from", errors);
      expectString(edge, "to", errors);
      expectString(edge, "id", errors);
      if ("edge_type" in edge || "data" in edge || "data_channel" in edge) {
        errors.push(`processFlow.edges[${index}] legacy edge_type/data/data_channel 필드는 허용되지 않습니다.`);
      }
      if (typeof edge.edge_kind !== "string" || !graphEdgeKinds.has(edge.edge_kind)) {
        errors.push(`processFlow.edges[${index}].edge_kind 값이 올바르지 않습니다.`);
      }
      if (typeof edge.execution_semantics !== "string" || !graphExecutionSemantics.has(edge.execution_semantics)) {
        errors.push(`processFlow.edges[${index}].execution_semantics 값이 올바르지 않습니다.`);
      }
      if (typeof edge.is_remote_boundary_crossing !== "boolean") {
        errors.push(`processFlow.edges[${index}].is_remote_boundary_crossing 값은 boolean이어야 합니다.`);
      }
      ["from_port", "to_port", "state_key", "artifact_key", "schema_ref", "route_condition", "a2a_contract_id"].forEach((key) => {
        const field = edge[key];
        if (field !== undefined && field !== null && !truthyString(field)) {
          errors.push(`processFlow.edges[${index}].${key} 값은 문자열 또는 null이어야 합니다.`);
        }
      });
      if (edge.edge_kind === "route" && !truthyString(edge.route_condition)) {
        errors.push(`processFlow.edges[${index}] route edge에는 route_condition이 필요합니다.`);
      }
      if (edge.edge_kind === "artifact" && !truthyString(edge.artifact_key)) {
        errors.push(`processFlow.edges[${index}] artifact edge에는 artifact_key가 필요합니다.`);
      }
      if (edge.edge_kind === "remote_a2a" && edge.is_remote_boundary_crossing !== true) {
        errors.push(`processFlow.edges[${index}] remote_a2a edge는 is_remote_boundary_crossing=true여야 합니다.`);
      }
    });
  }
}

function validateFields(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 배열이 필요합니다.`);
    return;
  }
  value.forEach((field, index) => {
    if (!isRecord(field)) {
      errors.push(`${label}[${index}] 객체가 필요합니다.`);
      return;
    }
    expectString(field, "name", errors);
    expectString(field, "type", errors);
  });
}

function validateSystems(value: unknown, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push("normalizedRequirement.systems 배열이 필요합니다.");
    return;
  }
  value.forEach((system, index) => {
    if (!isRecord(system)) {
      errors.push(`normalizedRequirement.systems[${index}] 객체가 필요합니다.`);
      return;
    }
    expectString(system, "name", errors);
    if (typeof system.access !== "string" || !systemAccess.has(system.access)) {
      errors.push(`normalizedRequirement.systems[${index}].access 값이 올바르지 않습니다.`);
    }
  });
}

function validateRiskSignals(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value)) {
    errors.push(`${label} 배열이 필요합니다.`);
    return;
  }
  value.forEach((signal) => {
    if (typeof signal !== "string" || !riskSignals.has(signal)) {
      errors.push(`${label}에 알 수 없는 risk signal이 있습니다.`);
    }
  });
}

function expectString(record: Record<string, unknown>, key: string, errors: string[]) {
  if (typeof record[key] !== "string" || !record[key]) {
    errors.push(`${key} 문자열 값이 필요합니다.`);
  }
}

function expectStringArray(value: unknown, label: string, errors: string[]) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${label} 문자열 배열이 필요합니다.`);
  }
}

function truthyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
