import type { CatalogEntry } from "../catalog/types";
import type {
  AgentExecutionMode,
  CatalogBinding,
  ComponentSource,
  FieldSpec,
  GraphCallControl,
  GraphDecisionOwner,
  GraphFlowKind,
  GraphInvokeBinding,
  GraphPolicy,
  GraphSideEffect,
  ModuleCandidate,
  NormalizedRequirement,
  ProcessFlow,
  RiskSignal,
  ScaffoldPlan,
  ScaffoldPlanModule,
  ScaffoldPlanRuntimeContract,
  ScaffoldOutputMode,
  RuntimeContract
} from "./types";
import { runtimeContractReadinessIssues } from "./runtimeContracts";

const DEFAULT_RUNNABLE_MODEL = "hosted_vllm/local-model";

export interface BuildScaffoldPlanInput {
  normalizedRequirement: NormalizedRequirement;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
  catalogEntries: CatalogEntry[];
  runtimeContracts?: RuntimeContract[];
  /** Defaults to `smoke`. `runnable` emits real LlmAgent/MCP wiring from the same approved artifacts. */
  outputMode?: ScaffoldOutputMode;
}

export function buildScaffoldPlan({
  normalizedRequirement,
  moduleCandidates,
  processFlow,
  catalogEntries,
  runtimeContracts = [],
  outputMode = "smoke"
}: BuildScaffoldPlanInput): ScaffoldPlan {
  const activeCatalog = catalogEntries.filter((entry) => entry.provenance !== "session_deleted");
  // The root workflow candidate (`root_workflow_module_id`) maps to the generated
  // `Workflow` itself — its Graph IR home is the root container, not a node — so it is
  // not a deployable scaffold module. Excluding it keeps scaffold modules 1:1 with graph
  // nodes (so the generator's graph-coverage check passes) and prevents it from being
  // counted as an unresolved/needs-info blocker.
  const rootWorkflowModuleId = processFlow?.root_workflow_module_id ?? null;
  const agentExecutionModes = agentExecutionModeByModuleId(processFlow);
  const graphNodeByModuleId = graphNodeByModuleIdFor(processFlow);
  const isRootWorkflowCandidate = (candidate: ModuleCandidate): boolean =>
    rootWorkflowModuleId !== null && candidate.id === rootWorkflowModuleId;
  const deployableCandidates = moduleCandidates.filter((candidate) => !isRootWorkflowCandidate(candidate));
  const modules = deployableCandidates
    .filter((candidate) => candidate.status === "approved")
    .map((candidate) =>
      buildScaffoldModule(
        candidate,
        activeCatalog,
        outputMode,
        agentExecutionModes.get(candidate.id) ?? null,
        graphNodeByModuleId.get(candidate.id) ?? null
      )
    );
  const excludedModules = [
    ...moduleCandidates.filter(isRootWorkflowCandidate).map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      status: candidate.status,
      reason: "루트 graph workflow는 생성되는 ADK Workflow 자체이므로 개별 scaffold 모듈로 포함하지 않습니다."
    })),
    ...deployableCandidates
      .filter((candidate) => candidate.status !== "approved")
      .map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        status: candidate.status,
        reason: `현재 상태가 ${candidate.status}입니다. scaffold generation에는 approved 모듈만 포함됩니다.`
      }))
  ];
  const blockers = collectBlockers(modules, deployableCandidates);
  blockers.push(...collectRunnableDynamicBlockers(outputMode, modules, processFlow));
  const runtimeContractPlans = runtimeContracts.map(toScaffoldRuntimeContract);
  blockers.push(...collectRuntimeContractBlockers(runtimeContracts));
  const warnings = collectWarnings(outputMode, modules, deployableCandidates, runtimeContracts);

  const scaffoldPlan = {
    requirement_id: normalizedRequirement.id,
    source: "approved_workbench_artifact" as const,
    raw_requirement_to_code: false as const,
    output_mode: outputMode,
    modules,
    runtime_contracts: runtimeContractPlans,
    graph: scaffoldGraphFor(processFlow),
    excluded_modules: excludedModules,
    manifest: {
      catalog_bound_modules: modules.flatMap((module) =>
        module.catalog_binding
          ? [
              {
                module_id: module.id,
                module_name: module.name,
                catalog_id: module.catalog_binding.catalog_id,
                catalog_name: module.catalog_binding.name,
                component_source: module.catalog_binding.component_source
              }
            ]
          : []
      ),
      new_code_required: modules.map((module) => ({
        module_id: module.id,
        module_name: module.name,
        reason: module.catalog_binding
          ? "catalog binding은 기록되었으며 런타임 wiring은 검토된 TODO boundary로 남깁니다."
          : "승인된 모듈에 선택된 카탈로그(catalog) binding이 없어 새 코드 TODO boundary로 생성합니다.",
        developer_todos: module.developer_todos
      }))
    },
    validation: {
      can_generate_source: modules.length > 0 && blockers.length === 0,
      blockers,
      warnings
    }
  };
  return scaffoldPlan;
}

function buildScaffoldModule(
  candidate: ModuleCandidate,
  catalogEntries: CatalogEntry[],
  outputMode: ScaffoldOutputMode,
  agentExecutionMode: AgentExecutionMode | null,
  graphNode: NonNullable<ProcessFlow["nodes"]>[number] | null
): ScaffoldPlanModule {
  const catalogEntry = findCatalogBinding(candidate, catalogEntries);
  const componentSource = componentSourceFor(catalogEntry);
  const binding: CatalogBinding | undefined = catalogEntry
    ? {
        catalog_id: catalogEntry.id,
        name: catalogEntry.name,
        component_source: componentSource
      }
    : undefined;
  const developerTodos = developerTodosFor(candidate, catalogEntry);
  const runnable = outputMode === "runnable";

  // MCP binding: prefer the reviewed candidate, fall back to the bound catalog entry.
  const accessProtocol = candidate.access_protocol ?? catalogEntry?.access_protocol ?? null;
  const mcpServer = candidate.mcp_server ?? catalogEntry?.mcp_server ?? null;
  const mcpToolName = candidate.mcp_tool_name ?? catalogEntry?.mcp_tool_name ?? null;
  const mcpSchemaRef = candidate.mcp_schema_ref ?? catalogEntry?.mcp_schema_ref ?? null;
  const mcpAuthMode = candidate.mcp_auth_mode ?? catalogEntry?.mcp_auth_mode ?? null;
  const runtimeBinding = normalizeRuntimeBinding(graphNode?.runtime_binding ?? catalogEntry?.runtime_binding ?? null);
  const invokeBinding = normalizeInvokeBinding(graphNode?.invoke_binding ?? null, graphNode?.node_kind ?? null);
  const decisionOwner = normalizeDecisionOwner(graphNode?.decision_owner ?? null);
  const callControl = normalizeCallControl(graphNode?.call_control ?? null);
  const sideEffect = normalizeGraphSideEffect(graphNode?.side_effect ?? null);
  const policy = normalizeGraphPolicy(graphNode?.policy ?? null);

  const isAgent = candidate.module_category === "agent";

  const scaffoldModule = {
    id: candidate.id,
    name: candidate.name,
    module_category: candidate.module_category,
    agent_kind: candidate.agent_kind ?? null,
    workflow_kind: candidate.workflow_kind ?? null,
    adapter_kind: candidate.adapter_kind ?? null,
    remote_contract_kind: candidate.remote_contract_kind ?? null,
    scaffold_output: runnable ? "runnable" : catalogEntry?.scaffold_output ?? scaffoldOutputFor(candidate),
    no_runnable_business_logic: !runnable,
    catalog_binding: binding,
    developer_todos: developerTodos,
    inputs: candidate.inputs,
    outputs: candidate.outputs,
    risk_signals: mergeRiskSignals(candidate.risk_signals, catalogEntry?.risk_signals ?? []),
    required_review_fields: requiredReviewFieldsFor(candidate),
    smoke_spec: candidate.smoke_spec ?? null,
    runtime_mock: catalogEntry?.runtime_mock ?? null,
    // Runnable-mode wiring only. Smoke mode keeps the module shape minimal
    // (everything null) so its output stays identical to the legacy stub plan.
    instruction: runnable && isAgent ? seedAgentInstruction(candidate, catalogEntry) : null,
    model: runnable && isAgent ? DEFAULT_RUNNABLE_MODEL : null,
    agent_execution_mode: runnable && isAgent ? agentExecutionMode ?? "single_turn" : null,
    access_protocol: runnable ? accessProtocol : null,
    mcp_server: runnable ? mcpServer : null,
    mcp_tool_name: runnable ? mcpToolName : null,
    mcp_schema_ref: runnable ? mcpSchemaRef : null,
    mcp_auth_mode: runnable ? mcpAuthMode : null,
    runtime_binding: runnable ? runtimeBinding : null,
    invoke_binding: runnable ? invokeBinding : null,
    decision_owner: runnable ? decisionOwner : null,
    call_control: runnable ? callControl : null,
    side_effect: runnable ? sideEffect : null,
    policy: runnable ? policy : null,
    node_kind: graphNode?.node_kind ?? null,
    workflow_ref: graphNode?.workflow_ref ?? null,
    input_mapping: graphNode?.input_mapping ?? null,
    output_mapping: graphNode?.output_mapping ?? null,
    mock_binding: runnable ? normalizeMockBinding(candidate, graphNode) : null,
    adk_skeleton_contract: adkSkeletonContractFor(candidate, graphNode, runnable)
  };
  return scaffoldModule;
}

function agentExecutionModeByModuleId(processFlow: ProcessFlow): Map<string, AgentExecutionMode> {
  const modes = new Map<string, AgentExecutionMode>();
  for (const node of processFlow?.nodes ?? []) {
    if (node.node_kind !== "agent" || typeof node.module_id !== "string") continue;
    modes.set(node.module_id, node.agent_execution_mode === "chat" ? "chat" : "single_turn");
  }
  return modes;
}

function graphNodeByModuleIdFor(processFlow: ProcessFlow): Map<string, ProcessFlow["nodes"][number]> {
  const nodes = new Map<string, ProcessFlow["nodes"][number]>();
  for (const node of processFlow?.nodes ?? []) {
    if (typeof node.module_id !== "string") continue;
    if (!nodes.has(node.module_id)) nodes.set(node.module_id, node);
  }
  return nodes;
}

function normalizeRuntimeBinding(value: unknown): ScaffoldPlanModule["runtime_binding"] {
  if (value === "mcp" || value === "mcp_tool") return "mcp_tool";
  if (
    value === "unresolved" ||
    value === "direct_api" ||
    value === "local_function" ||
    value === "remote_a2a" ||
    value === "workflow_call" ||
    value === "ui_input"
  ) {
    return value;
  }
  return null;
}

const GRAPH_INVOKE_BINDINGS = new Set([
  "unresolved",
  "local_python",
  "direct_api",
  "mcp_tool",
  "mcp_toolset",
  "local_function",
  "internal_workflow",
  "ui_input",
  "remote_a2a",
  "callback_wait",
  "unknown"
]);

const GRAPH_DECISION_OWNERS = new Set(["workflow_code", "llm", "human", "remote_agent", "system", "unknown"]);

const GRAPH_CALL_CONTROLS = new Set([
  "none",
  "fixed_by_workflow",
  "selected_by_llm",
  "selected_by_human",
  "event_callback",
  "resume",
  "unknown"
]);

const GRAPH_SIDE_EFFECTS = new Set(["none", "read", "write", "external_message", "transaction", "unknown"]);

const GRAPH_POLICIES = new Set([
  "none",
  "auth_required",
  "approval_required",
  "audit_required",
  "idempotency_required",
  "timeout_retry_required",
  "data_policy_required",
  "manual_fallback_required",
  "callback_resume_required",
  "compensation_required",
  "unknown"
]);

const GRAPH_FLOW_KINDS = new Set([
  "sequence",
  "route",
  "fan_out",
  "fan_in",
  "loop_back",
  "loop_exit",
  "fallback",
  "error",
  "resume",
  "callback",
  "unknown"
]);

function normalizeInvokeBinding(
  value: unknown,
  nodeKind: ProcessFlow["nodes"][number]["node_kind"] | null
): GraphInvokeBinding | null {
  if (typeof value === "string" && GRAPH_INVOKE_BINDINGS.has(value)) return value as GraphInvokeBinding;
  if (nodeKind === "workflow_call") return "internal_workflow";
  return null;
}

function normalizeDecisionOwner(value: unknown): GraphDecisionOwner | null {
  return typeof value === "string" && GRAPH_DECISION_OWNERS.has(value) ? (value as GraphDecisionOwner) : null;
}

function normalizeCallControl(value: unknown): GraphCallControl | null {
  return typeof value === "string" && GRAPH_CALL_CONTROLS.has(value) ? (value as GraphCallControl) : null;
}

function normalizeGraphSideEffect(value: unknown): GraphSideEffect | null {
  return typeof value === "string" && GRAPH_SIDE_EFFECTS.has(value) ? (value as GraphSideEffect) : null;
}

function normalizeGraphPolicy(value: unknown): GraphPolicy | null {
  return typeof value === "string" && GRAPH_POLICIES.has(value) ? (value as GraphPolicy) : null;
}

function normalizeFlowKind(value: unknown): GraphFlowKind | null {
  return typeof value === "string" && GRAPH_FLOW_KINDS.has(value) ? (value as GraphFlowKind) : null;
}

function normalizeMockBinding(candidate: ModuleCandidate, graphNode: NonNullable<ProcessFlow["nodes"]>[number] | null): ScaffoldPlanModule["mock_binding"] {
  if (candidate.module_category !== "adapter") return null;
  const connected = isFixedMcpAdapterCall(candidate, graphNode);
  if (graphNode?.mock_binding && connected) return graphNode.mock_binding;
  if (!candidate.mcp_server || !candidate.mcp_tool_name) {
    return {
      provider: "mock_lab",
      package_path: "packages/mock-lab",
      mock_server_id: null,
      tool_name: null,
      input_schema: candidate.mcp_schema_ref ?? null,
      output_schema: null,
      sample_response_ref: null,
      status: "missing"
    };
  }
  return {
    provider: "mock_lab",
    package_path: "packages/mock-lab",
    mock_server_id: candidate.mcp_server,
    tool_name: candidate.mcp_tool_name,
    input_schema: candidate.mcp_schema_ref ?? null,
    output_schema: null,
    sample_response_ref: null,
    status: connected ? "linked" : "missing"
  };
}

function isFixedMcpAdapterCall(
  candidate: ModuleCandidate,
  graphNode: NonNullable<ProcessFlow["nodes"]>[number] | null
): boolean {
  if (candidate.module_category !== "adapter") return false;
  const hasMcpTarget = Boolean(candidate.mcp_server && candidate.mcp_tool_name);
  if (!hasMcpTarget) return false;
  const hasExplicitGraphSemantics = graphNode?.invoke_binding != null || graphNode?.call_control != null;
  if (hasExplicitGraphSemantics) {
    return (
      graphNode?.node_kind === "adapter_call" &&
      graphNode.invoke_binding === "mcp_tool" &&
      graphNode.call_control === "fixed_by_workflow"
    );
  }
  return (
    graphNode?.runtime_binding === "mcp_tool" ||
    graphNode?.runtime_binding === "mcp" ||
    candidate.access_protocol === "mcp"
  );
}

function adkSkeletonContractFor(
  candidate: ModuleCandidate,
  graphNode: NonNullable<ProcessFlow["nodes"]>[number] | null,
  runnable: boolean
): ScaffoldPlanModule["adk_skeleton_contract"] {
  const nodeKind = graphNode?.node_kind;
  const isWorkflowCall = nodeKind === "workflow_call";
  const isMockAdapter = isFixedMcpAdapterCall(candidate, graphNode);
  if (graphNode?.adk_skeleton_contract && (candidate.module_category !== "adapter" || isMockAdapter)) {
    return graphNode.adk_skeleton_contract;
  }
  return {
    scaffold_level: runnable && (isWorkflowCall || isMockAdapter || candidate.module_category === "agent") ? "mock_testable_skeleton" : "handoff",
    target_runtime: "adk_python_2_x",
    implementation_template: isWorkflowCall
      ? "workflow_call_stub"
      : isMockAdapter
        ? "mcp_mock_adapter_stub"
        : candidate.module_category === "agent"
            ? "llm_agent_stub"
            : "adapter_placeholder_stub",
    manual_completion_required: true,
    developer_todos: isWorkflowCall
      ? ["workflow_call target skeleton 연결 확인", "input/output mapping 검토"]
      : isMockAdapter
        ? ["Mock Lab MCP tool binding 확인", "실제 EAI/API client로 교체할 TODO 유지"]
        : ["검토된 scaffold boundary 안에서 개발자가 수동 보강"]
  };
}

function scaffoldGraphFor(processFlow: ProcessFlow) {
  return {
    nodes: (processFlow?.nodes ?? []).map((node) => ({
      id: node.id,
      module_id: node.module_id,
      node_kind: node.node_kind,
      invoke_binding: normalizeInvokeBinding(node.invoke_binding ?? null, node.node_kind),
      decision_owner: normalizeDecisionOwner(node.decision_owner ?? null),
      call_control: normalizeCallControl(node.call_control ?? null),
      side_effect: normalizeGraphSideEffect(node.side_effect ?? null),
      policy: normalizeGraphPolicy(node.policy ?? null),
      human_input_contract: node.human_input_contract ?? null
    })),
    edges: (processFlow?.edges ?? []).map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      edge_kind: edge.edge_kind,
      schema_ref: edge.schema_ref ?? null,
      route_condition: edge.route_condition ?? null,
      route_aliases: edge.route_aliases ?? [],
      is_default_route: edge.is_default_route === true,
      state_key: edge.state_key ?? null,
      artifact_key: edge.artifact_key ?? null,
      flow_kind: normalizeFlowKind(edge.flow_kind ?? null),
      call_control: normalizeCallControl(edge.call_control ?? null)
    }))
  };
}

/**
 * Auto-seed an LlmAgent instruction from reviewed-artifact fields only
 * (catalog responsibility / candidate rationale / reviewed I/O field names /
 * the synthetic smoke sample) — never from raw requirement text, so the
 * "raw requirements never drive code" invariant holds. The seed is a starting
 * point the developer reviews and edits in the generated bundle's
 * `agents.config.yaml` before any live run; the prompt itself instructs the
 * model to use only the synthetic inputs and never invent private data or
 * credentials.
 */
function seedAgentInstruction(candidate: ModuleCandidate, catalogEntry: CatalogEntry | undefined): string {
  const responsibility = catalogEntry?.responsibility?.trim() || candidate.rationale?.trim() || candidate.name;
  const inputNames = candidate.inputs.map((field) => field.name).filter(Boolean).join(", ") || "지정된 입력 없음";
  const outputNames = candidate.outputs.map((field) => field.name).filter(Boolean).join(", ") || "지정된 출력 없음";
  const lines = [
    `당신은 "${candidate.name}" Agent입니다.`,
    `책임: ${responsibility}`,
    `입력: ${inputNames}.`,
    `출력: ${outputNames}.`,
    "검토된 synthetic 입력과 session state 안의 데이터만 사용하세요. private data, 실제 endpoint, credential은 만들거나 추정하지 마세요."
  ];
  const sample = candidate.smoke_spec?.sample_user_message?.trim();
  if (sample) lines.push(`예시 사용자 메시지: ${sample}`);
  return lines.join("\n");
}

function findCatalogBinding(candidate: ModuleCandidate, entries: CatalogEntry[]): CatalogEntry | undefined {
  if (candidate.catalog_entry_id) {
    const exact = entries.find((entry) => entry.id === candidate.catalog_entry_id);
    if (exact) return exact;
  }
  const normalizedName = normalizeName(candidate.name);
  return entries.find(
    (entry) => entry.module_category === candidate.module_category && normalizeName(entry.name) === normalizedName
  );
}

function componentSourceFor(entry: CatalogEntry | undefined): ComponentSource {
  if (!entry) return "stub";
  if (entry.component_source) return entry.component_source;
  if (entry.runtime_binding === "remote_a2a") return "remote_a2a";
  if (entry.access_protocol === "mcp") return "mcp";
  return "stub";
}

function developerTodosFor(
  candidate: ModuleCandidate,
  catalogEntry: CatalogEntry | undefined
): string[] {
  if (catalogEntry) {
    return [
      "catalog runtime 계약을 검토하고 호출 전에 런타임 binding 설정을 확인하세요.",
      "검토된 입력과 출력을 매핑한 뒤 런타임 동작을 연결하세요."
    ];
  }
  if (candidate.module_category === "remote_a2a") {
    return [
      "remote agent card 또는 discovery 계약을 검토 가능한 값으로 채우세요.",
      "런타임 사용 전에 인증, timeout, retry, fallback, audit, data policy 처리를 구현하세요."
    ];
  }
  if (candidate.module_category === "workflow") {
    return [
      "workflow_call target skeleton 연결 방식과 version을 확인하세요.",
      "하위 Workflow input/output mapping을 검토하고 실제 동적 로직은 target Workflow 내부에서 수동 보강하세요."
    ];
  }
  return [
    "설계 승인 후 TODO_IMPLEMENT_HERE 경계 안에서만 이 모듈을 구현하세요.",
    "검토된 입력을 매핑하고 출력을 검증하며 business credential은 생성 코드에 넣지 마세요."
  ];
}

function requiredReviewFieldsFor(candidate: ModuleCandidate): string[] {
  const fields = new Set<string>();
  if (!candidate.inputs.length) fields.add("inputs");
  if (!candidate.outputs.length) fields.add("outputs");
  if (!candidate.developer_todos?.length) fields.add("developer_todos");
  if (candidate.module_category === "remote_a2a") {
    [
      "owner",
      "agent_card",
      "auth",
      "task_lifecycle",
      "timeout",
      "retry",
      "fallback",
      "audit",
      "data_policy"
    ].forEach((field) => fields.add(field));
  }
  return [...fields];
}

function collectBlockers(modules: ScaffoldPlanModule[], candidates: ModuleCandidate[]): string[] {
  const unresolvedCandidates = countUnresolvedMissingInfoCandidates(candidates);
  const blockers: string[] = [];
  if (unresolvedCandidates > 0) {
    blockers.push(`정보 필요 후보 ${unresolvedCandidates}개를 모듈 검토에서 Resolution Draft를 반영하고 승인하세요.`);
  }
  if (!modules.length) {
    blockers.push("ADK source generation 전에 approved 모듈이 필요합니다.");
    return blockers;
  }
  return [
    ...blockers,
    ...modules.flatMap((module) => {
      const moduleBlockers: string[] = [];
      if (!module.inputs.length) moduleBlockers.push(`${module.name}: 입력 계약이 없습니다.`);
      if (!module.outputs.length) moduleBlockers.push(`${module.name}: 출력 계약이 없습니다.`);
      if (!module.developer_todos.length) moduleBlockers.push(`${module.name}: developer TODO boundary가 없습니다.`);
      return moduleBlockers;
    })
  ];
}

// Dynamic Workflow stays design/contract-only in this skeleton scope: the
// runnable ADK generator (`assertRunnableGraphSupported`) rejects dynamic
// workflow modules and `dynamic_workflow` containers. Mirror that rejection at
// plan-validation time so `can_generate_source` never reports a runnable plan
// the generator will then refuse — surface the workflow_call redirect instead.
function collectRunnableDynamicBlockers(
  outputMode: ScaffoldOutputMode,
  modules: ScaffoldPlanModule[],
  processFlow: ProcessFlow
): string[] {
  if (outputMode !== "runnable") return [];
  const blockers: string[] = [];
  for (const module of modules) {
    if (module.module_category === "workflow" && module.workflow_kind === "dynamic") {
      blockers.push(
        `${module.name}: Dynamic Workflow는 runnable 생성 대상이 아닙니다. 하위 업무 Workflow로 분리하고 parent graph에서 workflow_call 노드로 조립하세요.`
      );
    }
  }
  const dynamicContainers = (processFlow?.containers ?? []).filter(
    (container) => container?.container_kind === "dynamic_workflow"
  );
  if (dynamicContainers.length > 0) {
    blockers.push(
      `dynamic_workflow container ${dynamicContainers.length}개는 runnable 생성 대상이 아닙니다. design/contract container로 유지하고 동적 흐름은 workflow_call로 조립하세요.`
    );
  }
  return blockers;
}

function collectRuntimeContractBlockers(contracts: RuntimeContract[]): string[] {
  return contracts.flatMap((contract) => {
    const issues = runtimeContractReadinessIssues(contract);
    if (!issues.length) return [];
    return [`${contract.title}: Runtime 계약 검토/승인이 필요합니다 (${issues.join("; ")})`];
  });
}

function collectWarnings(
  outputMode: ScaffoldOutputMode,
  modules: ScaffoldPlanModule[],
  candidates: ModuleCandidate[],
  runtimeContracts: RuntimeContract[]
): string[] {
  const moduleWarnings = modules.flatMap((module) => {
    const warnings = module.catalog_binding
      ? [`${module.name}: catalog binding은 설정 승인 전까지 검토된 런타임 wiring TODO로 표시됩니다.`]
      : [`${module.name}: 선택된 catalog binding이 없어 새 코드 TODO boundary로 생성됩니다.`];
    if (outputMode === "runnable") {
      warnings.push(runnableSkeletonWarning(module));
    }
    return warnings;
  });
  const unresolvedCandidates = countUnresolvedMissingInfoCandidates(candidates);
  if (unresolvedCandidates > 0) {
    moduleWarnings.push(`정보 필요 후보 ${unresolvedCandidates}개 — 모듈 검토에서 Resolution Draft 반영 필요`);
  }
  if (runtimeContracts.length > 0) {
    moduleWarnings.push(`Runtime 계약 ${runtimeContracts.length}개가 scaffold-plan에 포함됩니다.`);
  }
  return moduleWarnings;
}

function runnableSkeletonWarning(module: ScaffoldPlanModule): string {
  if (module.module_category === "agent") {
    return `${module.name}: LlmAgent smoke TODO skeleton입니다. 검토된 artifact와 synthetic 입력만 wiring하며 production business logic은 포함하지 않습니다.`;
  }
  if (module.module_category === "adapter" && module.mock_binding?.provider === "mock_lab" && module.mock_binding.status === "linked") {
    return `${module.name}: Mock Lab MCP synthetic adapter skeleton입니다. local smoke 검증용 binding이며 실제 endpoint, credential, private data는 포함하지 않습니다.`;
  }
  if (module.module_category === "remote_a2a") {
    return `${module.name}: RemoteA2aAgent smoke TODO skeleton입니다. Agent Card와 protocol boundary 검토용이며 운영 remote agent 구현이 아닙니다.`;
  }
  if (module.module_category === "workflow") {
    return `${module.name}: Workflow smoke TODO skeleton입니다. Graph IR 연결 검증용이며 운영 orchestration logic은 reviewer가 채워야 합니다.`;
  }
  return `${module.name}: Runnable smoke TODO skeleton입니다. 검토된 계약을 확인하는 handoff 산출물이며 운영 구현이 아닙니다.`;
}

function toScaffoldRuntimeContract(contract: RuntimeContract): ScaffoldPlanRuntimeContract {
  return {
    contract_id: contract.contract_id,
    contract_kind: contract.contract_kind,
    module_id: contract.module_id,
    title: contract.title,
    contract_status: contract.contract_status,
    required_review_fields: contract.required_review_fields,
    runtime_support: contract.runtime_support,
    operation: contract.operation,
    identifiers: contract.identifiers,
    policies: contract.policies,
    graph_ir_annotations: contract.graph_ir_annotations,
    developer_todos: contract.developer_todos
  };
}

function countUnresolvedMissingInfoCandidates(candidates: ModuleCandidate[]): number {
  return candidates.filter((candidate) => {
    if (candidate.missing_information.length > 0) return true;
    return candidate.status === "needs_info" && !candidateResolutionReady(candidate);
  }).length;
}

function candidateResolutionReady(candidate: ModuleCandidate): boolean {
  return Boolean(
    candidate.resolution_applied_at &&
      candidate.schema_review_state === "applied" &&
      candidate.smoke_spec?.ready &&
      candidate.inputs.length > 0 &&
      candidate.outputs.length > 0
  );
}

function scaffoldOutputFor(candidate: ModuleCandidate): string {
  if (candidate.module_category === "adapter") return "contract_or_stub_only";
  if (candidate.module_category === "agent") return "agent_shell_only";
  if (candidate.module_category === "workflow") return "orchestration_shell_only";
  return "contract_placeholder_only";
}

function mergeRiskSignals(primary: RiskSignal[], secondary: RiskSignal[]): RiskSignal[] {
  return [...new Set([...primary, ...secondary])];
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
