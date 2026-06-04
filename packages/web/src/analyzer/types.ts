export const moduleCategories = ["agent", "workflow", "adapter", "remote_a2a"] as const;

export const adapterKinds = [
  "legacy_api",
  "retrieval",
  "rule_registry",
  "data_query",
  "template",
  "computation",
  "external_service",
  "unknown"
] as const;

export const agentKinds = ["specialist", "shared"] as const;

export const workflowKinds = [
  "orchestration",
  "graph",
  "dynamic",
  "unknown"
] as const;

export const remoteContractKinds = ["a2a", "unknown"] as const;

export const accessProtocols = ["local", "http_rest", "mcp", "grpc", "message_queue", "unknown"] as const;

export const bankDomains = ["고객", "수신", "여신", "카드", "리스크"] as const;
export const requirementDomains = ["공통", ...bankDomains] as const;

export const riskSignals = [
  "personal_data",
  "financial_data",
  "credit_decision_support",
  "customer_impact",
  "external_message",
  "transaction_write",
  "human_approval_required",
  "audit_required"
] as const;

export const legacyRecommendedTypes = [
  "tool_adapter",
  "knowledge_retrieval",
  "internal_workflow",
  "specialist_agent",
  "shared_agent",
  "metadata_registry",
  "remote_a2a_contract"
] as const;

export const codexAnalyzerModels = [
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.3-codex-spark"
] as const;

// A2A 1.0/latest contract enumerations.
// These constants are the single source of truth for the validator and UI.
export const A2A_OPERATION_NAMES = [
  "SendMessage",
  "SendStreamingMessage",
  "GetTask",
  "SubscribeToTask",
  "CancelTask",
  "ListTasks"
] as const;

export const A2A_HTTP_PATHS = [
  "/message:send",
  "/message:stream",
  "/tasks/{id}",
  "/tasks/{id}:subscribe",
  "/tasks/{id}:cancel"
] as const;

export const A2A_TASK_STATES = [
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_AUTH_REQUIRED",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_REJECTED"
] as const;

export const A2A_PART_FIELDS = ["text", "raw", "url", "data"] as const;

export const A2A_ROLES = ["ROLE_USER", "ROLE_AGENT"] as const;

export const A2A_STREAM_WRAPPERS = ["task", "message", "taskStatusUpdate", "taskArtifactUpdate"] as const;

export const A2A_CONTRACT_STATUSES = ["draft", "needs_info", "approved"] as const;

export const RUNTIME_CONTRACT_KINDS = [
  "mcp_legacy_adapter",
  "eai_legacy_adapter",
  "context_manager",
  "callback_broker",
  "adk_callback",
  "async_resume"
] as const;

export const RUNTIME_CONTRACT_STATUSES = ["draft", "needs_info", "approved", "rejected"] as const;

// Stale terminology that must not appear inside a serialized contract object.
// Per spec §5 last paragraph: old slash-form ops, legacy request wrapper names,
// lowercase task states, bare task states without TASK_STATE_ prefix, removed
// terminal stream markers, removed stream discriminators, old concrete Part
// class names, and `file` as a Part content field.
export const A2A_STALE_NAMES = [
  // old slash-form operation names
  "tasks/send",
  "tasks/sendSubscribe",
  "tasks/get",
  "tasks/cancel",
  "tasks/pushNotification/set",
  "tasks/pushNotification/get",
  "tasks/resubscribe",
  "tasks/list",
  // legacy request wrapper names
  "SendTaskRequest",
  "SendTaskResponse",
  "SendTaskStreamingRequest",
  "SendTaskStreamingResponse",
  "GetTaskRequest",
  "GetTaskResponse",
  "CancelTaskRequest",
  "CancelTaskResponse",
  "TaskSendParams",
  "TaskQueryParams",
  "TaskIdParams",
  // lowercase task-state words
  "submitted",
  "working",
  "input-required",
  "completed",
  "failed",
  "canceled",
  "rejected",
  "auth-required",
  // bare task states without TASK_STATE_ prefix
  "SUBMITTED",
  "WORKING",
  "INPUT_REQUIRED",
  "AUTH_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "REJECTED",
  // removed terminal stream markers
  "final",
  "TaskStatusUpdateEvent",
  "TaskArtifactUpdateEvent",
  // removed stream discriminators
  "isFinal",
  "lastChunk",
  // old concrete Part class names
  "TextPart",
  "FilePart",
  "DataPart",
  // `file` as a Part content field
  "file"
] as const;

export type ModuleCategory = (typeof moduleCategories)[number];
export type AdapterKind = (typeof adapterKinds)[number];
export type AgentKind = (typeof agentKinds)[number];
export type WorkflowKind = (typeof workflowKinds)[number];
export type RemoteContractKind = (typeof remoteContractKinds)[number];
export type AccessProtocol = (typeof accessProtocols)[number];
export type BankDomain = (typeof bankDomains)[number];
export type RequirementDomain = (typeof requirementDomains)[number];
export type RiskSignal = (typeof riskSignals)[number];
export type LegacyRecommendedType = (typeof legacyRecommendedTypes)[number];
export type CodexAnalyzerModel = (typeof codexAnalyzerModels)[number];
export type SideEffect = "none" | "read" | "write" | "read_write" | "unknown";

export type A2AOperationName = (typeof A2A_OPERATION_NAMES)[number];
export type A2AHttpPath = (typeof A2A_HTTP_PATHS)[number];
export type A2ATaskState = (typeof A2A_TASK_STATES)[number];
export type TaskState = A2ATaskState;
export type A2APartField = (typeof A2A_PART_FIELDS)[number];
export type A2ARole = (typeof A2A_ROLES)[number];
export type A2AStreamWrapper = (typeof A2A_STREAM_WRAPPERS)[number];
export type A2AContractStatus = (typeof A2A_CONTRACT_STATUSES)[number];
export type RuntimeContractKind = (typeof RUNTIME_CONTRACT_KINDS)[number];
export type RuntimeContractStatus = (typeof RUNTIME_CONTRACT_STATUSES)[number];

export type RiskLevel = "low" | "medium" | "high";
export type ModuleStatus = "needs_info" | "approved" | "deferred" | "rejected";
export type RequirementStatus = "draft" | "reviewed" | "approved" | "rejected";
export type ComponentSource = "mcp" | "remote_a2a" | "stub";

export interface RuntimeContract {
  contract_id: string;
  contract_kind: RuntimeContractKind;
  module_id: string | null;
  title: string;
  contract_status: RuntimeContractStatus;
  summary: string;
  required_review_fields: string[];
  reviewer_notes: string;
  runtime_support: {
    context_manager_required: boolean;
    callback_broker_required: boolean;
    human_approval_required: boolean;
    idempotency_required: boolean;
    audit_required: boolean;
    compensation_required: boolean;
  };
  operation: {
    operation_type: "read" | "write" | "approval" | "batch" | "notification" | "unknown";
    side_effect_level: "none" | "read_only" | "write" | "financial_write" | "customer_notification" | "unknown";
    callback_expected: boolean;
    async_resume_required: boolean;
  };
  identifiers: string[];
  policies: {
    auth_policy: string;
    timeout_policy: string;
    retry_policy: string;
    fallback_policy: string;
    masking_policy: string;
    data_policy: string;
  };
  graph_ir_annotations: Record<string, string>;
  synthetic_examples: Array<Record<string, unknown>>;
  developer_todos: string[];
}

export interface FieldSpec {
  name: string;
  type: string;
  required?: boolean;
  schema?: JsonSchema;
}

export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean | JsonSchema;
}

export interface SystemSpec {
  name: string;
  access: "unknown" | "read" | "write" | "read_write" | "not_required";
}

export interface RequirementIntakeInput {
  domain: RequirementDomain;
  rawText: string;
}

export interface NormalizedRequirement {
  id: string;
  title: string;
  raw_text: string;
  domain: string;
  requester: {
    team: string;
    role: string;
  };
  business_goal: string;
  current_process: string[];
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  systems: SystemSpec[];
  risk_signals: RiskSignal[];
  missing_information: string[];
  contradictions: string[];
  status: RequirementStatus;
}

export interface EvidenceSummary {
  requested_goal: string;
  business_domain_hint: string;
  user_role: string;
  input_data: string[];
  output_data: string[];
  systems_mentioned: string[];
  decisions_implied: string[];
  risk_signals: RiskSignal[];
  missing_information: string[];
  contradictions: string[];
  assumptions: string[];
}

export interface AdkHints {
  state_memory?: string;
  callbacks?: string;
  artifacts_events?: string;
  mcp_a2a?: string;
  streaming_grounding?: string;
}

export interface ModuleCandidate {
  id: string;
  source_requirement_id: string;
  catalog_entry_id?: string | null;
  name: string;
  module_category: ModuleCategory;
  agent_kind?: AgentKind | null;
  workflow_kind?: WorkflowKind | null;
  adapter_kind?: AdapterKind | null;
  remote_contract_kind?: RemoteContractKind | null;
  access_protocol?: AccessProtocol | null;
  mcp_server?: string;
  mcp_tool_name?: string;
  mcp_schema_ref?: string;
  mcp_auth_mode?: string;
  legacy_recommended_type?: LegacyRecommendedType | string;
  confidence: number;
  rationale: string;
  adk_hints?: AdkHints;
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  reuse_candidate: boolean;
  risk_level: RiskLevel;
  risk_signals: RiskSignal[];
  status: ModuleStatus;
  missing_information: string[];
  missing_information_resolution?: string;
  resolved_missing_information?: string[];
  resolution_draft?: ModuleResolutionDraft | null;
  resolution_applied_at?: string | null;
  schema_review_state?: "not_started" | "drafted" | "applied";
  smoke_spec?: ModuleSmokeSpec | null;
  side_effect?: SideEffect;
  auth_required?: boolean;
  audit_required?: boolean;
  citation_required?: boolean;
  grounding_required?: boolean;
  source_acl_required?: boolean;
  versioned?: boolean;
  effective_date_required?: boolean;
  owner_domain?: string;
  owner?: string;
  agent_card?: string;
  auth?: string;
  task_lifecycle?: string;
  timeout?: string;
  retry?: string;
  fallback?: string;
  audit?: string;
  data_policy?: string;
  /**
   * For remote_a2a candidates this links 1:1 to an A2AContract by contract_id.
   * Required at validator time when module_category === "remote_a2a"; null or
   * undefined for non-remote candidates.
   */
  a2a_contract_id?: string | null;
  developer_todos?: string[];
}

export interface ModuleResolutionAnswer {
  missing_item: string;
  resolved_value: string;
  rationale: string;
  confidence: number;
  target_artifacts: Array<"inputs" | "outputs" | "runtime_config" | "catalog_test_double" | "graph" | "chat_smoke" | "developer_todos">;
  status: "draft" | "applied" | "rejected";
}

export interface ModuleSmokeSpec {
  sample_user_message: string;
  synthetic_inputs: Record<string, unknown>;
  expected_output_shape: JsonSchema;
  expected_event_markers: string[];
  mock_sources: string[];
  ready: boolean;
}

export interface ModuleResolutionDraft {
  candidate_id: string;
  generated_at: string;
  summary: string;
  answers: ModuleResolutionAnswer[];
  input_schema: FieldSpec[];
  output_schema: FieldSpec[];
  developer_todos: string[];
  graph_patch_notes: string[];
  smoke_spec: ModuleSmokeSpec;
  reviewer_note: string;
}

/**
 * A2A 1.0/latest interaction contract for a single remote_a2a candidate.
 * Spec §5. String fields use the runtime convention that the literal
 * "needs_info" is a placeholder satisfying presence but flagged for review.
 */
export interface A2AContract {
  /** Pattern: a2a-NNN. */
  contract_id: string;
  /** Must reference an existing remote_a2a ModuleCandidate id. */
  remote_module_id: string;
  target_agent_name: string;
  target_agent_purpose: string;
  contract_status: A2AContractStatus;
  agent_card: {
    discovery_method: string;
    agent_card_url: string;
    version: string;
    notes: string;
  };
  supported_interfaces: Array<{
    url: string;
    protocol_binding: string;
    protocol_version: string;
    tenant_policy: string;
  }>;
  input_modes: string[];
  output_modes: string[];
  security_schemes: Array<{ name: string; scheme: string }>;
  security_requirements: Array<{ scheme_name: string; scopes: string[] }>;
  skills: string[];
  extensions: string[];
  message_contract: {
    allowed_part_fields: A2APartField[];
    allowed_roles: A2ARole[];
  };
  task_lifecycle: {
    states: TaskState[];
    allowed_transitions: Array<{ from: TaskState; to: TaskState }>;
    terminal_states: TaskState[];
    input_required_followup: string;
    auth_required_followup: string;
  };
  streaming: {
    supported: boolean;
    wrappers: A2AStreamWrapper[];
    non_streaming_fallback: string;
  };
  operations: A2AOperationName[];
  http_paths: A2AHttpPath[];
  artifact_contract: {
    mutation_rules: string;
    chunking_policy: string;
  };
  adk_host_mapping: string;
  timeout: string;
  retry: string;
  fallback: string;
  cancellation: string;
  unsupported_operation: string;
  get_task_fallback: string;
  /** Spec §5 explicitly allows null when no push notification policy is required. */
  push_notification_policy: string | null;
  auth: string;
  token_handling: string;
  audit: string;
  data_policy: string;
}

export interface CatalogBinding {
  catalog_id: string;
  name: string;
  component_source: ComponentSource;
}

/**
 * Scaffold output mode. `smoke` (default) keeps the synthetic, no-runnable-logic
 * handoff. `runnable` emits the reviewed ADK 2.1 LlmAgent/Workflow graph that
 * calls Gemini and live Mock Lab MCP servers. In BOTH modes the source is still
 * the approved workbench artifacts — `raw_requirement_to_code` stays false and
 * raw requirements never drive code generation.
 */
export type ScaffoldOutputMode = "smoke" | "runnable";

export interface ScaffoldPlanModule {
  id: string;
  name: string;
  module_category: ModuleCategory;
  agent_kind: AgentKind | null;
  workflow_kind: WorkflowKind | null;
  adapter_kind: AdapterKind | null;
  remote_contract_kind: RemoteContractKind | null;
  scaffold_output: string;
  /** `true` in smoke mode; `false` is allowed only when `ScaffoldPlan.output_mode === "runnable"`. */
  no_runnable_business_logic: boolean;
  catalog_binding?: CatalogBinding;
  developer_todos: string[];
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  risk_signals: RiskSignal[];
  required_review_fields: string[];
  smoke_spec?: ModuleSmokeSpec | null;
  runtime_mock?: Record<string, unknown> | null;
  /**
   * Runnable-mode wiring. Null/absent in smoke mode. `instruction`/`model` seed
   * the LlmAgent for agent-kind modules; the `mcp_*`/`access_protocol`/
   * `runtime_binding` fields declare the intended Mock Lab MCP binding for
   * adapter-kind modules. Live connected/unconnected status is resolved by the
   * generator against the running Mock Lab registry, not recorded here.
   */
  instruction?: string | null;
  model?: string | null;
  access_protocol?: AccessProtocol | null;
  mcp_server?: string | null;
  mcp_tool_name?: string | null;
  mcp_schema_ref?: string | null;
  mcp_auth_mode?: string | null;
  runtime_binding?: "unresolved" | "mcp" | "remote_a2a" | null;
}

export interface ScaffoldPlanRuntimeContract {
  contract_id: string;
  contract_kind: RuntimeContractKind;
  module_id: string | null;
  title: string;
  contract_status: RuntimeContractStatus;
  required_review_fields: string[];
  runtime_support: RuntimeContract["runtime_support"];
  operation: RuntimeContract["operation"];
  identifiers: string[];
  policies: RuntimeContract["policies"];
  graph_ir_annotations: Record<string, string>;
  developer_todos: string[];
}

export interface ExcludedScaffoldModule {
  id: string;
  name: string;
  status: ModuleStatus;
  reason: string;
}

export interface ScaffoldPlan {
  requirement_id: string;
  source: "approved_workbench_artifact";
  raw_requirement_to_code: false;
  /** Defaults to `smoke`. Drives `no_runnable_business_logic` and `scaffold_output` semantics. */
  output_mode: ScaffoldOutputMode;
  modules: ScaffoldPlanModule[];
  runtime_contracts: ScaffoldPlanRuntimeContract[];
  excluded_modules: ExcludedScaffoldModule[];
  manifest: {
    catalog_bound_modules: Array<{
      module_id: string;
      module_name: string;
      catalog_id: string;
      catalog_name: string;
      component_source: ComponentSource;
    }>;
    new_code_required: Array<{
      module_id: string;
      module_name: string;
      reason: string;
      developer_todos: string[];
    }>;
  };
  validation: {
    can_generate_source: boolean;
    blockers: string[];
    warnings: string[];
  };
}

// ---------------------------------------------------------------------------
// ADK 2.0 Graph IR — replaces the legacy stage-based ProcessFlow.
//
// The persisted field name remains `processFlow` for migration compatibility,
// but the inner shape is native Graph IR. New artifacts must use
// `node_kind`, `edge_kind`, `execution_semantics`, and `data_label`.
// ---------------------------------------------------------------------------

export const GRAPH_NODE_KINDS = [
  "input",
  "output",
  "agent",
  "function",
  "tool",
  "adapter",
  "human_input",
  "workflow",
  "remote_a2a",
  "join",
  "router",
  "loop_control"
] as const;

export const GRAPH_CONTAINER_KINDS = [
  "graph_workflow",
  "dynamic_workflow",
  "parallel_region",
  "loop_region",
  "human_review_region",
  "remote_boundary"
] as const;

export const GRAPH_EDGE_KINDS = [
  "event_output",
  "event_message",
  "session_state",
  "temp_state",
  "user_state",
  "app_state",
  "artifact",
  "route",
  "control",
  "remote_a2a"
] as const;

export const GRAPH_LANE_IDS = [
  "input",
  "local_graph",
  "adapter",
  "human_input",
  "output",
  "remote_boundary"
] as const;

export const GRAPH_LAYOUT_POLICIES = [
  "dag_with_routes",
  "fan_out_fan_in",
  "loop",
  "linear",
  "free"
] as const;

export const GRAPH_EXECUTION_SEMANTICS = [
  "normal_transition",
  "fan_out",
  "fan_in",
  "loop_back",
  "loop_exit",
  "conditional",
  "boundary_crossing"
] as const;

export type NodeKind = (typeof GRAPH_NODE_KINDS)[number];
export type ContainerKind = (typeof GRAPH_CONTAINER_KINDS)[number];
export type EdgeKind = (typeof GRAPH_EDGE_KINDS)[number];
export type LaneId = (typeof GRAPH_LANE_IDS)[number];
export type LayoutPolicy = (typeof GRAPH_LAYOUT_POLICIES)[number];
export type ExecutionSemantics = (typeof GRAPH_EXECUTION_SEMANTICS)[number];
export type OwnerScope = "local" | "remote" | "external";

export interface GraphPort {
  id: string;
  label: string;
  schema_ref: string | null;
}

export interface GraphValidationIssue {
  code: string;
  message: string;
  target_kind: "node" | "edge" | "container" | "graph";
  target_id: string | null;
}

export interface GraphValidation {
  ok: boolean;
  errors: GraphValidationIssue[];
  warnings: GraphValidationIssue[];
}

export interface GraphLane {
  id: LaneId;
  label: string;
}

export interface GraphContainer {
  id: string;
  module_id: string | null;
  label: string;
  container_kind: ContainerKind;
  adk_mapping: string | null;
  contains_node_ids: string[];
  entry_node_ids: string[];
  exit_node_ids: string[];
  layout_policy: LayoutPolicy;
  parent_container_id: string | null;
}

export interface GraphNode {
  id: string;
  label: string;
  module_id: string | null;
  node_kind: NodeKind;
  execution_kind: string | null;
  adk_node_role: "workflow_node" | "container_root" | "boundary" | "synthetic" | null;
  owner_scope: OwnerScope;
  container_id: string | null;
  lane_id: LaneId;
  input_ports: GraphPort[];
  output_ports: GraphPort[];
  schema_refs: string[];
  review_status: ModuleStatus | "n/a";
}

export interface GraphEdge {
  from: string;
  to: string;
  id: string;
  from_port: string | null;
  to_port: string | null;
  edge_kind: EdgeKind;
  execution_semantics: ExecutionSemantics;
  data_label: string;
  schema_ref: string | null;
  route_condition: string | null;
  state_key: string | null;
  artifact_key: string | null;
  a2a_contract_id: string | null;
  is_remote_boundary_crossing: boolean;
}

export interface GraphIR {
  requirement_id: string;
  graph_id: string;
  root_workflow_module_id: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  containers: GraphContainer[];
  lanes: GraphLane[];
  validation: GraphValidation;
}

// Legacy aliases. Do not introduce new code that consumes these names — use
// GraphIR / GraphNode / GraphEdge directly.
export type ProcessFlow = GraphIR;
export type FlowNode = GraphNode;
export type FlowEdge = GraphEdge;

export interface ClassificationSummary {
  module_id: string;
  name: string;
  selected_category: ModuleCategory;
  subtype: string | null;
  why_agent?: string;
  why_adapter?: string;
  why_workflow?: string;
  why_not_remote_a2a?: string;
  why_remote_a2a?: string;
}

export interface CommonizationNotes {
  confirmed_reuse_bindings: string[];
  proposed_shared_agents: string[];
  proposed_adapter_catalog_entries: string[];
  proposed_workflow_reuse: string[];
  remote_a2a_contracts: string[];
  deferred_reuse: string[];
  rejected_reuse: string[];
}

export interface AnalysisResult {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  moduleCandidates: ModuleCandidate[];
  /**
   * A2A 1.0 contracts for remote_a2a candidates. Always present; empty array
   * when no remote_a2a candidates exist. 1:1 pairing with remote candidates
   * is enforced by the validator.
   */
  a2aContracts: A2AContract[];
  runtimeContracts: RuntimeContract[];
  processFlow: ProcessFlow;
}

export interface CatalogReference {
  id: string;
  name: string;
  module_category: ModuleCategory;
  subtype: string | null;
  runtime_binding?: string | null;
  access_protocol?: AccessProtocol | null;
  mcp_server?: string | null;
  mcp_tool_name?: string | null;
  mcp_schema_ref?: string | null;
  mcp_auth_mode?: string | null;
  component_source?: ComponentSource | null;
  contract_status?: string | null;
  owner_domain?: string | null;
  status?: string | null;
  responsibility?: string | null;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  risk_signals?: RiskSignal[];
}
