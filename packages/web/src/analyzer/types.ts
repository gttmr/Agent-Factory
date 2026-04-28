export const moduleTypes = [
  "tool_adapter",
  "knowledge_retrieval",
  "internal_workflow",
  "specialist_agent",
  "shared_agent",
  "metadata_registry",
  "remote_a2a_contract"
] as const;

export type ModuleType = (typeof moduleTypes)[number];

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
  recommended_type: ModuleType;
  confidence: number;
  rationale: string;
  inputs: FieldSpec[];
  outputs: FieldSpec[];
  reuse_candidate: boolean;
  risk_level: RiskLevel;
  status: ModuleStatus;
}

export type FlowNodeType = ModuleType | "input" | "output";
export type FlowEdgeType = "local" | "remote_a2a";

export interface FlowNode {
  id: string;
  label: string;
  type: FlowNodeType;
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

export interface AnalysisResult {
  normalizedRequirement: NormalizedRequirement;
  evidence: EvidenceSummary;
  moduleCandidates: ModuleCandidate[];
  processFlow: ProcessFlow;
}
