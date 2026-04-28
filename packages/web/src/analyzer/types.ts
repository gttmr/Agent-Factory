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

export const legacyRecommendedTypes = [
  "tool_adapter",
  "knowledge_retrieval",
  "internal_workflow",
  "specialist_agent",
  "shared_agent",
  "metadata_registry",
  "remote_a2a_contract"
] as const;

export type ModuleCategory = (typeof moduleCategories)[number];
export type AdapterKind = (typeof adapterKinds)[number];
export type AgentKind = (typeof agentKinds)[number];
export type WorkflowKind = (typeof workflowKinds)[number];
export type RemoteContractKind = (typeof remoteContractKinds)[number];
export type LegacyRecommendedType = (typeof legacyRecommendedTypes)[number];
export type SideEffect = "none" | "read" | "write" | "read_write" | "unknown";

export type RiskLevel = "low" | "medium" | "high";
export type ModuleStatus = "needs_review" | "approved" | "deferred" | "rejected";
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
  risk_signals: string[];
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
  risk_signals: string[];
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
  why_adapter_not_agent?: string;
  why_workflow_not_remote_a2a?: string;
  remote_a2a_decision?: string;
}

export interface CommonizationNotes {
  reusable_adapters: string[];
  shared_agent_candidates: string[];
  workflow_reuse_candidates: string[];
  remote_a2a_contracts: string[];
}

export interface AnalysisResult {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
}
