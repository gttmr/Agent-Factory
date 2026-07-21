import type { AnalysisResult, AssetCandidate, RuntimeContract } from "./types";

export function assetCandidate(overrides: Partial<AssetCandidate> = {}): AssetCandidate {
  return {
    asset_id: "agent.reviewer",
    source_requirement_id: "req-001",
    catalog_entry_id: null,
    name: "Reviewer",
    asset_type: "agent",
    domain_scope: "domain_neutral",
    business_domains: [],
    owner: "platform",
    reuse_status: "project_only",
    capability_tags: [],
    binding: null,
    connection: null,
    workflow_profile: null,
    exposure: null,
    confidence: 0.9,
    rationale: "Reviews the request",
    inputs: [],
    outputs: [],
    risk_level: "low",
    risk_signals: [],
    status: "approved",
    missing_information: [],
    developer_todos: [],
    ...overrides
  };
}

export function runtimeContract(overrides: Partial<RuntimeContract> = {}): RuntimeContract {
  return {
    contract_id: "runtime-agent-reviewer-context-manager",
    contract_kind: "context_manager",
    asset_id: "agent.reviewer",
    title: "Reviewer context manager",
    contract_status: "approved",
    summary: "Reviewer context management boundary",
    required_review_fields: [],
    reviewer_notes: "Reviewed",
    runtime_support: {
      context_manager_required: true,
      callback_broker_required: false,
      human_approval_required: false,
      idempotency_required: false,
      audit_required: false,
      compensation_required: false
    },
    operation: {
      operation_type: "read",
      side_effect_level: "read_only",
      callback_expected: false,
      async_resume_required: false
    },
    identifiers: [],
    policies: {
      auth_policy: "not_required",
      timeout_policy: "not_required",
      retry_policy: "not_required",
      fallback_policy: "not_required",
      masking_policy: "not_required",
      data_policy: "synthetic_only"
    },
    graph_ir_annotations: {},
    synthetic_examples: [],
    developer_todos: [],
    ...overrides
  };
}

export function strictAnalysisFixture(): AnalysisResult {
  const workflow = assetCandidate({
    asset_id: "workflow.review",
    name: "Review workflow",
    asset_type: "workflow",
    binding: null,
    connection: null,
    workflow_profile: { representation: "graph", coordination: "explicit", template_ref: null },
    rationale: "Owns the review flow"
  });
  return {
    contract_version: "2.0",
    normalizedRequirement: {
      id: "req-001",
      title: "Review request",
      raw_text: "Review a request",
      domain: "공통",
      requester: { team: "platform", role: "developer" },
      business_goal: "Review the request",
      current_process: [],
      inputs: [],
      outputs: [],
      systems: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      status: "draft"
    },
    evidence: {
      requested_goal: "Review the request",
      business_domain_hint: "공통",
      user_role: "developer",
      input_data: [],
      output_data: [],
      systems_mentioned: [],
      decisions_implied: [],
      risk_signals: [],
      missing_information: [],
      contradictions: [],
      assumptions: []
    },
    assetCandidates: [workflow, assetCandidate()],
    a2aContracts: [],
    runtimeContracts: [],
    graph: {
      graph_id: "graph-001",
      source_requirement_id: "req-001",
      workflow_ref: workflow.asset_id,
      nodes: [
        { id: "node-input", label: "Input", node_kind: "input" },
        { id: "node-agent", label: "Reviewer", node_kind: "agent", agent_ref: "agent.reviewer", available_tools: [] },
        { id: "node-output", label: "Output", node_kind: "output" }
      ],
      edges: [
        { id: "edge-001", from: "node-input", to: "node-agent", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" },
        { id: "edge-002", from: "node-agent", to: "node-output", control: { kind: "next", condition: null, accepted_aliases: [], default: false }, channel: "event" }
      ],
      regions: []
    }
  };
}
