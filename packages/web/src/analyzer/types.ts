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
  "sequential",
  "parallel",
  "loop",
  "human_review",
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

export type RiskLevel = "low" | "medium" | "high";
export type ModuleStatus = "needs_info" | "approved" | "deferred" | "rejected";
export type RequirementStatus = "draft" | "reviewed" | "approved" | "rejected";
export type ComponentSource = "python_package" | "mcp" | "stub";

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
  developer_todos?: string[];
}

export interface CatalogBinding {
  catalog_id: string;
  name: string;
  component_source: ComponentSource;
}

export interface ImportContract {
  package_name: string;
  package_version?: string;
  import_path: string;
  callable_name: string;
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
  import_contract?: ImportContract;
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
    imported_components: Array<{
      module_id: string;
      module_name: string;
      catalog_id: string;
      package_name: string;
      package_version?: string;
      import_path: string;
      callable_name: string;
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

export type FlowNodeType = "input" | "output" | ModuleCategory;
export type FlowEdgeType = "local" | "remote_a2a";
export type FlowDataChannel =
  | "event_output"
  | "event_message"
  | "session_state"
  | "temp_state"
  | "user_state"
  | "app_state"
  | "artifact"
  | "route"
  | "control"
  | "unknown";

export interface FlowNode {
  id: string;
  label: string;
  type: FlowNodeType;
  subtype?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  data: string;
  edge_type: FlowEdgeType;
  data_channel?: FlowDataChannel;
  state_key?: string | null;
  artifact_key?: string | null;
  schema_ref?: string | null;
  route_condition?: string | null;
}

export interface ProcessFlow {
  requirement_id: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

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

export interface ReuseHeatmapItem {
  capability: string;
  module_category: ModuleCategory;
  subtype: string | null;
  reuse_score: number;
  domains: BankDomain[];
  candidate_status: ModuleStatus;
  rationale: string;
}

export interface DomainCapabilityMapRow {
  capability: string;
  module_category: ModuleCategory;
  subtype: string | null;
  domains: Record<BankDomain, "낮음" | "중간" | "높음">;
}

export interface AnalysisResult {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  moduleCandidates: ModuleCandidate[];
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
  package_name?: string | null;
  package_version?: string | null;
  import_path?: string | null;
  callable_name?: string | null;
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
