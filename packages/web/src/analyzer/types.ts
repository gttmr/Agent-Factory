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

export type RiskLevel = "low" | "medium" | "high";
export type ModuleStatus = "needs_info" | "approved" | "deferred" | "rejected";
export type RequirementStatus = "draft" | "reviewed" | "approved" | "rejected";
export type ComponentSource = "mcp" | "stub";

export interface FieldSpec {
  name: string;
  type: string;
  required?: boolean;
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

export interface ScaffoldPlanModule {
  id: string;
  name: string;
  module_category: ModuleCategory;
  agent_kind: AgentKind | null;
  workflow_kind: WorkflowKind | null;
  adapter_kind: AdapterKind | null;
  remote_contract_kind: RemoteContractKind | null;
  scaffold_output: string;
  no_runnable_business_logic: true;
  catalog_binding?: CatalogBinding;
  developer_todos: string[];
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  risk_signals: RiskSignal[];
  required_review_fields: string[];
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
  modules: ScaffoldPlanModule[];
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
  processFlow: ProcessFlow;
}

export interface CatalogReference {
  id: string;
  name: string;
  module_category: ModuleCategory;
  subtype: string | null;
  access_protocol?: AccessProtocol | null;
  mcp_server?: string | null;
  mcp_tool_name?: string | null;
  mcp_schema_ref?: string | null;
  mcp_auth_mode?: string | null;
  component_source?: ComponentSource | null;
  owner_domain?: string | null;
  status?: string | null;
  responsibility?: string | null;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  risk_signals?: RiskSignal[];
}

export type AnalyzerProgressPhase = "started" | "cli_event" | "diagnostic" | "completed" | "failed" | "timeout";
export type AnalyzerTraceKind =
  | "tool_call"
  | "tool_result"
  | "assistant_message"
  | "reasoning_summary"
  | "lifecycle"
  | "diagnostic";
export type AnalyzerTraceStatus = "running" | "completed" | "failed" | "timeout" | "info";

export interface AnalyzerProgressEvent {
  phase: AnalyzerProgressPhase;
  message: string;
  at: string;
  elapsedMs: number;
  model?: string;
  timeoutMs?: number;
  inputChars?: number;
  promptChars?: number;
  eventCount?: number;
  eventType?: string;
  lastEventType?: string;
  eventTypeCounts?: Record<string, number>;
  traceKind?: AnalyzerTraceKind;
  title?: string;
  snippet?: string;
  snippetFull?: string;
  toolName?: string;
  status?: AnalyzerTraceStatus;
  durationMs?: number;
  rawEventType?: string;
  sequence?: number;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
  result?: AnalysisResult;
}
