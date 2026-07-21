export const TARGET_CONTRACT_VERSION = "2.0" as const;

export const assetTypes = ["agent", "workflow", "tool"] as const;
export const domainScopes = ["domain_specific", "cross_domain", "domain_neutral"] as const;
export const reuseStatuses = ["not_reviewed", "reuse_existing", "publish_candidate", "project_only", "excluded"] as const;
export const bindingKinds = ["function", "mcp", "built_in", "a2a", "unresolved"] as const;
export const transportKinds = ["in_process", "stdio", "http", "unknown"] as const;
export const workflowRepresentations = ["graph", "dynamic", "unresolved"] as const;
export const workflowCoordinations = ["explicit", "agent_delegation", "mixed"] as const;
export const invocationControls = ["workflow", "agent"] as const;
export const graphNodeKinds = ["input", "agent", "tool", "function", "human_input", "subworkflow", "join", "output"] as const;
export const graphControlKinds = [
  "next",
  "condition",
  "fan_out",
  "fan_in",
  "loop_back",
  "loop_exit",
  "retry",
  "fallback",
  "error",
  "callback",
  "resume",
  "cancel",
  "timeout"
] as const;
export const graphChannels = ["event", "state", "artifact"] as const;
export const graphRegionKinds = ["parallel", "loop"] as const;
export const functionRoles = ["transform", "validate", "route", "merge", "prepare_input", "format_output"] as const;

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
export const sideEffects = ["none", "read", "write", "read_write", "unknown"] as const;
export const codexAnalyzerModels = ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.3-codex-spark"] as const;

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
export const A2A_RUNTIME_AUTH_MODES = ["none", "bearer_env", "metadata_env"] as const;
export const A2A_RUNTIME_FALLBACK_MODES = ["none", "manual_review", "local_event"] as const;
export const A2A_STALE_NAMES = [
  "tasks/send",
  "tasks/sendSubscribe",
  "tasks/get",
  "tasks/cancel",
  "tasks/pushNotification/set",
  "tasks/pushNotification/get",
  "tasks/resubscribe",
  "tasks/list",
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
  "submitted",
  "working",
  "input-required",
  "completed",
  "failed",
  "canceled",
  "rejected",
  "auth-required",
  "SUBMITTED",
  "WORKING",
  "INPUT_REQUIRED",
  "AUTH_REQUIRED",
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "REJECTED",
  "final",
  "TaskStatusUpdateEvent",
  "TaskArtifactUpdateEvent",
  "isFinal",
  "lastChunk",
  "TextPart",
  "FilePart",
  "DataPart",
  "file"
] as const;

export const RUNTIME_CONTRACT_KINDS = [
  "mcp_connection",
  "external_connection",
  "context_manager",
  "callback_broker",
  "adk_callback",
  "async_resume"
] as const;
export const RUNTIME_CONTRACT_STATUSES = ["draft", "needs_info", "approved", "rejected"] as const;

export type AssetType = (typeof assetTypes)[number];
export type DomainScope = (typeof domainScopes)[number];
export type ReuseStatus = (typeof reuseStatuses)[number];
export type BindingKind = (typeof bindingKinds)[number];
export type TransportKind = (typeof transportKinds)[number];
export type WorkflowRepresentation = (typeof workflowRepresentations)[number];
export type WorkflowCoordination = (typeof workflowCoordinations)[number];
export type InvocationControl = (typeof invocationControls)[number];
export type NodeKind = (typeof graphNodeKinds)[number];
export type GraphControlKind = (typeof graphControlKinds)[number];
export type GraphChannel = (typeof graphChannels)[number];
export type GraphRegionKind = (typeof graphRegionKinds)[number];
export type FunctionRole = (typeof functionRoles)[number];
export type BankDomain = (typeof bankDomains)[number];
export type RequirementDomain = (typeof requirementDomains)[number];
export type RiskSignal = (typeof riskSignals)[number];
export type SideEffect = (typeof sideEffects)[number];
export type CodexAnalyzerModel = (typeof codexAnalyzerModels)[number];
export type A2AOperationName = (typeof A2A_OPERATION_NAMES)[number];
export type A2AHttpPath = (typeof A2A_HTTP_PATHS)[number];
export type A2ATaskState = (typeof A2A_TASK_STATES)[number];
export type TaskState = A2ATaskState;
export type A2APartField = (typeof A2A_PART_FIELDS)[number];
export type A2ARole = (typeof A2A_ROLES)[number];
export type A2AStreamWrapper = (typeof A2A_STREAM_WRAPPERS)[number];
export type A2AContractStatus = (typeof A2A_CONTRACT_STATUSES)[number];
export type A2ARuntimeAuthMode = (typeof A2A_RUNTIME_AUTH_MODES)[number];
export type A2ARuntimeFallbackMode = (typeof A2A_RUNTIME_FALLBACK_MODES)[number];
export type RuntimeContractKind = (typeof RUNTIME_CONTRACT_KINDS)[number];
export type RuntimeContractStatus = (typeof RUNTIME_CONTRACT_STATUSES)[number];
export type RiskLevel = "low" | "medium" | "high";
export type AssetStatus = "needs_info" | "approved" | "deferred" | "rejected";
export type RequirementStatus = "draft" | "reviewed" | "approved" | "rejected";
export type ScaffoldLevel = "none" | "handoff" | "mock_testable_skeleton" | "manual_required";
export type ScaffoldOutputMode = "smoke" | "runnable";
export const AGENT_EXECUTION_MODES = ["single_turn", "chat"] as const;
export type AgentExecutionMode = (typeof AGENT_EXECUTION_MODES)[number];

export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: Array<string | number | boolean | null>;
  additionalProperties?: boolean | JsonSchema;
}

export interface FieldSpec {
  name: string;
  type: string;
  required?: boolean;
  schema?: JsonSchema;
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
  requester: { team: string; role: string };
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
  accepted_missing_information?: string[];
}

export interface AdkHints {
  state_memory?: string;
  callbacks?: string;
  artifacts_events?: string;
  mcp_a2a?: string;
  streaming_grounding?: string;
}

export type AssetBinding =
  | { kind: "function" }
  | { kind: "built_in" }
  | { kind: "unresolved" }
  | { kind: "mcp"; server_ref: string; tool_name: string }
  | { kind: "a2a"; contract_ref: string };

export interface AssetConnection {
  transport: TransportKind;
}

export interface WorkflowProfile {
  representation: WorkflowRepresentation;
  coordination: WorkflowCoordination;
  template_ref: string | null;
}

export interface AssetExposure {
  protocol: "a2a";
  contract_ref: string;
}

export interface AvailableToolReference {
  tool_ref: string;
  invocation_control: "agent";
}

export interface AssetSmokeSpec {
  sample_user_message: string;
  synthetic_inputs: Record<string, unknown>;
  expected_output_shape: JsonSchema;
  expected_event_markers: string[];
  mock_sources: string[];
  ready: boolean;
}

export interface AssetResolutionAnswer {
  missing_item: string;
  resolved_value: string;
  rationale: string;
  confidence: number;
  target_artifacts: Array<"inputs" | "outputs" | "runtime_config" | "catalog_test_double" | "graph" | "chat_smoke" | "developer_todos">;
  status: "draft" | "applied" | "rejected";
}

export interface AssetResolutionDraft {
  asset_id: string;
  generated_at: string;
  summary: string;
  answers: AssetResolutionAnswer[];
  input_schema: FieldSpec[];
  output_schema: FieldSpec[];
  developer_todos: string[];
  graph_patch_notes: string[];
  smoke_spec: AssetSmokeSpec;
  reviewer_note: string;
}

export interface AssetCandidate {
  asset_id: string;
  source_requirement_id: string;
  catalog_entry_id: string | null;
  name: string;
  asset_type: AssetType;
  domain_scope: DomainScope;
  business_domains: string[];
  owner: string;
  reuse_status: ReuseStatus;
  capability_tags: string[];
  binding: AssetBinding | null;
  connection: AssetConnection | null;
  workflow_profile: WorkflowProfile | null;
  exposure: AssetExposure | null;
  confidence: number;
  rationale: string;
  adk_hints?: AdkHints;
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  risk_level: RiskLevel;
  risk_signals: RiskSignal[];
  status: AssetStatus;
  missing_information: string[];
  missing_information_resolution?: string;
  resolved_missing_information?: string[];
  resolution_draft?: AssetResolutionDraft | null;
  resolution_applied_at?: string | null;
  schema_review_state?: "not_started" | "drafted" | "applied";
  smoke_spec?: AssetSmokeSpec | null;
  side_effect?: SideEffect;
  auth_required?: boolean;
  audit_required?: boolean;
  citation_required?: boolean;
  grounding_required?: boolean;
  source_acl_required?: boolean;
  versioned?: boolean;
  effective_date_required?: boolean;
  developer_todos?: string[];
}

export interface A2ARuntimePolicy {
  timeout_seconds: number | null;
  auth: { mode: A2ARuntimeAuthMode; env_var: string | null; metadata_key: string | null };
  retry_handoff: { max_attempts: number | null; backoff_seconds: number | null; retry_on: string[] };
  fallback_handoff: { mode: A2ARuntimeFallbackMode; message: string | null };
}

export interface A2AContract {
  contract_id: string;
  agent_ref: string;
  target_agent_name: string;
  target_agent_purpose: string;
  contract_status: A2AContractStatus;
  agent_card: { discovery_method: string; agent_card_url: string; version: string; notes: string };
  supported_interfaces: Array<{ url: string; protocol_binding: string; protocol_version: string; tenant_policy: string }>;
  input_modes: string[];
  output_modes: string[];
  security_schemes: Array<{ name: string; scheme: string }>;
  security_requirements: Array<{ scheme_name: string; scopes: string[] }>;
  skills: string[];
  extensions: string[];
  message_contract: { allowed_part_fields: A2APartField[]; allowed_roles: A2ARole[] };
  task_lifecycle: {
    states: TaskState[];
    allowed_transitions: Array<{ from: TaskState; to: TaskState }>;
    terminal_states: TaskState[];
    input_required_followup: string;
    auth_required_followup: string;
  };
  streaming: { supported: boolean; wrappers: A2AStreamWrapper[]; non_streaming_fallback: string };
  operations: A2AOperationName[];
  http_paths: A2AHttpPath[];
  artifact_contract: { mutation_rules: string; chunking_policy: string };
  adk_host_mapping: string;
  adk_runtime_policy: A2ARuntimePolicy;
  timeout: string;
  retry: string;
  fallback: string;
  cancellation: string;
  unsupported_operation: string;
  get_task_fallback: string;
  push_notification_policy: string | null;
  auth: string;
  token_handling: string;
  audit: string;
  data_policy: string;
}

export interface RuntimeContract {
  contract_id: string;
  contract_kind: RuntimeContractKind;
  asset_id: string | null;
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
  resume_policy?: AsyncResumePolicy | null;
  side_effect_guard?: AsyncResumeSideEffectGuard | null;
  graph_ir_annotations: Record<string, string>;
  synthetic_examples: Array<Record<string, unknown>>;
  developer_todos: string[];
}

export interface AsyncResumePolicy {
  interrupt_id: string;
  correlation_scope: "invocation";
  timeout_seconds: number;
  on_timeout: "expire_without_side_effect";
  duplicate_response: "return_recorded_result";
  conflicting_response: "reject";
  restart_policy: "resume_incomplete_replay_completed";
}

export interface AsyncResumeSideEffectGuard {
  tool_ref: string;
  idempotency_key_input: string;
  delivery_semantics: "at_most_once";
  ledger_scope: "session_state";
}

export interface HumanInputContract {
  message: string;
  payload_schema_ref: string | null;
  response_schema_ref: string | null;
  response_mapping: Record<string, string> | null;
  choice_options?: string[] | null;
  accepted_aliases?: Record<string, string[]> | null;
  default_choice?: string | null;
}

export interface GraphNodeBase {
  id: string;
  label: string;
}
export type GraphNode =
  | (GraphNodeBase & { node_kind: "input" | "join" | "output" })
  | (GraphNodeBase & { node_kind: "agent"; agent_ref: string; available_tools: AvailableToolReference[] })
  | (GraphNodeBase & { node_kind: "tool"; tool_ref: string; invocation_control: "workflow" })
  | (GraphNodeBase & { node_kind: "function"; role: FunctionRole })
  | (GraphNodeBase & { node_kind: "human_input"; human_input_contract: HumanInputContract })
  | (GraphNodeBase & { node_kind: "subworkflow"; workflow_ref: string });

export interface GraphEdgeControl {
  kind: GraphControlKind;
  condition: string | null;
  accepted_aliases: string[];
  default: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  control: GraphEdgeControl;
  channel: GraphChannel | null;
}

export interface GraphRegion {
  id: string;
  kind: GraphRegionKind;
  node_ids: string[];
  entry_node_ids: string[];
  exit_node_ids: string[];
  parent_region_id: string | null;
}

export interface GraphIR {
  graph_id: string;
  source_requirement_id: string;
  /** Null when the reviewed solution is a standalone Agent or Tool. */
  workflow_ref: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  regions: GraphRegion[];
}

/** Derived review diagnostics; never serialized into Graph IR. */
export interface GraphValidationIssue {
  code: string;
  message: string;
  target_kind: "node" | "edge" | "region" | "graph";
  target_id: string | null;
}

/** Derived review diagnostics; never serialized into Graph IR. */
export interface GraphValidation {
  ok: boolean;
  errors: GraphValidationIssue[];
  warnings: GraphValidationIssue[];
}

export interface AnalysisResult {
  contract_version: typeof TARGET_CONTRACT_VERSION;
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  assetCandidates: AssetCandidate[];
  a2aContracts: A2AContract[];
  runtimeContracts: RuntimeContract[];
  graph: GraphIR;
}

export interface AdkSkeletonContract {
  scaffold_level: ScaffoldLevel;
  target_runtime?: "adk_python_2_x";
  entrypoint?: "root_agent";
  generation_mode?: "deterministic_template" | "llm_assisted_patch" | "manual";
  implementation_template: string;
  manual_completion_required: boolean;
  developer_todos: string[];
}

export interface ScaffoldPlan {
  contract_version: typeof TARGET_CONTRACT_VERSION;
  requirement_id: string;
  package_name?: string;
  source: "approved_workbench_artifact";
  raw_requirement_to_code: false;
  output_mode: ScaffoldOutputMode;
  assets: AssetCandidate[];
  runtime_contracts: RuntimeContract[];
  excluded_assets: Array<{ asset_id: string; name: string; status: AssetStatus; reason: string }>;
  graph: GraphIR;
  manifest: {
    catalog_bound_assets: Array<{
      asset_id: string;
      asset_name: string;
      catalog_id: string;
      catalog_name: string;
    }>;
    new_code_required: Array<{ asset_id: string; asset_name: string; reason: string; developer_todos: string[] }>;
  };
  validation: { can_generate_source: boolean; blockers: string[]; warnings: string[] };
}

export interface CatalogReference {
  id: string;
  name: string;
  asset_type: AssetType;
  domain_scope: DomainScope;
  business_domains: string[];
  owner: string;
  reuse_status: ReuseStatus;
  capability_tags: string[];
  binding: AssetBinding;
  connection: AssetConnection;
  workflow_profile: WorkflowProfile | null;
  exposure: AssetExposure | null;
  status?: string | null;
  responsibility?: string | null;
  inputs?: FieldSpec[];
  outputs?: FieldSpec[];
  composition?: string[];
  risk_signals?: RiskSignal[];
}
