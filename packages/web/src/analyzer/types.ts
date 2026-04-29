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

export const workflowKinds = ["sequential", "parallel", "loop", "human_review", "orchestration", "unknown"] as const;

export const remoteContractKinds = ["a2a", "unknown"] as const;

export const bankDomains = ["고객", "수신", "여신", "카드", "리스크"] as const;

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
export type BankDomain = (typeof bankDomains)[number];
export type RiskSignal = (typeof riskSignals)[number];
export type LegacyRecommendedType = (typeof legacyRecommendedTypes)[number];
export type CodexAnalyzerModel = (typeof codexAnalyzerModels)[number];
export type SideEffect = "none" | "read" | "write" | "read_write" | "unknown";

export type RiskLevel = "low" | "medium" | "high";
export type ModuleStatus = "needs_info" | "approved" | "deferred" | "rejected";
export type RequirementStatus = "draft" | "reviewed" | "approved" | "rejected";

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
  title: string;
  domainHint: string;
  rawText: string;
  requesterTeam: string;
  requesterRole: string;
  knownSystems: string;
  expectedOutput: string;
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

export interface ModuleCandidate {
  id: string;
  source_requirement_id: string;
  name: string;
  module_category: ModuleCategory;
  agent_kind?: AgentKind | null;
  workflow_kind?: WorkflowKind | null;
  adapter_kind?: AdapterKind | null;
  remote_contract_kind?: RemoteContractKind | null;
  legacy_recommended_type?: LegacyRecommendedType | string;
  confidence: number;
  rationale: string;
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  reuse_candidate: boolean;
  risk_level: RiskLevel;
  risk_signals: RiskSignal[];
  status: ModuleStatus;
  side_effect?: SideEffect;
  auth_required?: boolean;
  audit_required?: boolean;
  citation_required?: boolean;
  grounding_required?: boolean;
  source_acl_required?: boolean;
  versioned?: boolean;
  effective_date_required?: boolean;
  owner_domain?: string;
}

export type FlowNodeType = "input" | "output" | ModuleCategory;
export type FlowEdgeType = "local" | "remote_a2a";

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
  toolName?: string;
  status?: AnalyzerTraceStatus;
  durationMs?: number;
  rawEventType?: string;
  sequence?: number;
  lastTraceTitle?: string;
  lastTraceSnippet?: string;
  result?: AnalysisResult;
}
